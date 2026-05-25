#!/usr/bin/env python3
import csv
from email.parser import BytesParser
from email.policy import default
import html
import io
import json
import os
import posixpath
import re
import unicodedata
import zipfile
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree as ET
from zoneinfo import ZoneInfo

OUTPUT_DIR = Path('/srv/www/wolf.discount/furnituredistributors')
IMAGE_DIR = OUTPUT_DIR / 'manager-specials-images'
PAGE_MAP = {
    'living room': 'living-room.html',
    'bedroom': 'bedroom.html',
    'dinning room': 'kitchen-dining.html',
    'recliner': 'recliners.html',
}

CARD_TABLE_START = '<!-- Cards -->'
CARD_TABLE_END = '<!-- Logic -->'

PRICE_RE = re.compile(r'(\d[\d,]*)')
CELL_REF_RE = re.compile(r'^([A-Z]+)(\d+)$')
MOJIBAKE_RE = re.compile(r'[ÃÂâ€œâ€�â€™â€˜]')
CONTROL_CHARS_RE = re.compile(r'[\x00-\x08\x0B-\x1F\x7F]')
SPREADSHEET_NS = {
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'rel': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'pkgrel': 'http://schemas.openxmlformats.org/package/2006/relationships',
    'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
}


def normalize_section(name: str) -> str:
    normalized = clean_text(name).lower()
    if normalized == 'dining room':
        return 'dinning room'
    return normalized


def parse_price(value: str) -> int:
    if not value:
        return 0
    match = PRICE_RE.search(value)
    if not match:
        return 0
    return int(match.group(1).replace(',', ''))


def format_qty(value: str) -> str:
    text = clean_text(value)
    if not text:
        return ''
    if re.fullmatch(r'\d+(?:\.0+)?', text):
        return str(int(float(text)))
    if re.fullmatch(r'\d{1,3}(?:,\d{3})+', text):
        return text
    text = re.sub(r'\s*/\s*', ' / ', text)
    return text


def maybe_fix_mojibake(value: str) -> str:
    if not value or not MOJIBAKE_RE.search(value):
        return value
    for source_encoding in ('cp1252', 'latin-1'):
        try:
            repaired = value.encode(source_encoding).decode('utf-8')
        except Exception:
            continue
        if repaired:
            return repaired
    return value


def clean_text(value: str, *, strip_leading_symbols: bool = False) -> str:
    text = str(value or '')
    text = text.replace('\ufeff', '').replace('ï»¿', '')
    text = maybe_fix_mojibake(text)
    text = unicodedata.normalize('NFKC', text)
    text = text.replace('\u00a0', ' ')
    text = text.replace('\u200b', '').replace('\u200c', '').replace('\u200d', '').replace('\u2060', '')
    text = CONTROL_CHARS_RE.sub('', text)
    text = re.sub(r'\s+', ' ', text).strip()
    if strip_leading_symbols:
        while text and not text[0].isalnum():
            text = text[1:]
        text = text.strip()
    return text


def header_map(headers):
    mapping = {}
    for i, header in enumerate(headers):
        cleaned = clean_text(header).lower()
        if cleaned:
            mapping[cleaned] = i
    return mapping


def get_value(row, mapping, *names):
    for name in names:
        idx = mapping.get(name)
        if idx is not None and idx < len(row):
            value = clean_text(row[idx])
            if value:
                return value
    return ''


def column_index_from_ref(cell_ref: str) -> int:
    match = CELL_REF_RE.match(cell_ref.upper())
    if not match:
        return 0
    column = 0
    for ch in match.group(1):
        column = column * 26 + (ord(ch) - 64)
    return column


def resolve_zip_path(base_path: str, target: str) -> str:
    target = (target or '').replace('\\', '/')
    if target.startswith('/'):
        return target.lstrip('/')
    return posixpath.normpath(posixpath.join(posixpath.dirname(base_path), target))


def load_shared_strings(archive: zipfile.ZipFile):
    if 'xl/sharedStrings.xml' not in archive.namelist():
        return []
    root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
    values = []
    for item in root.findall('main:si', SPREADSHEET_NS):
        text = ''.join(node.text or '' for node in item.findall('.//main:t', SPREADSHEET_NS))
        values.append(text)
    return values


def first_sheet_path(archive: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(archive.read('xl/workbook.xml'))
    rel_root = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
    rels = {
        rel.attrib.get('Id', ''): resolve_zip_path('xl/workbook.xml', rel.attrib.get('Target', ''))
        for rel in rel_root.findall('pkgrel:Relationship', SPREADSHEET_NS)
    }
    sheet = workbook.find('main:sheets/main:sheet', SPREADSHEET_NS)
    if sheet is None:
        raise ValueError('Workbook has no sheets')
    rel_id = sheet.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id', '')
    sheet_path = rels.get(rel_id)
    if not sheet_path:
        raise ValueError('Workbook sheet relationship missing')
    return sheet_path


def cell_text(cell, shared_strings):
    cell_type = cell.attrib.get('t', '')
    if cell_type == 'inlineStr':
        return ''.join(node.text or '' for node in cell.findall('.//main:t', SPREADSHEET_NS))
    value_node = cell.find('main:v', SPREADSHEET_NS)
    if value_node is None or value_node.text is None:
        return ''
    raw = value_node.text
    if cell_type == 's':
        try:
            return shared_strings[int(raw)]
        except Exception:
            return ''
    return raw


def row_to_values(row_map):
    if not row_map:
        return []
    values = [''] * max(row_map.keys())
    for col_idx, value in row_map.items():
        values[col_idx - 1] = value
    return values


def read_sheet_rows(archive: zipfile.ZipFile, sheet_path: str):
    shared_strings = load_shared_strings(archive)
    root = ET.fromstring(archive.read(sheet_path))
    rows = []
    for row in root.findall('.//main:sheetData/main:row', SPREADSHEET_NS):
        row_idx = int(row.attrib.get('r', '0') or 0)
        values = {}
        for cell in row.findall('main:c', SPREADSHEET_NS):
            ref = cell.attrib.get('r', '')
            col_idx = column_index_from_ref(ref)
            if not col_idx:
                continue
            values[col_idx] = clean_text(cell_text(cell, shared_strings))
        if values:
            rows.append((row_idx, row_to_values(values)))
    return rows


def read_sheet_drawing_paths(archive: zipfile.ZipFile, sheet_path: str):
    rels_path = resolve_zip_path(sheet_path, f'_rels/{Path(sheet_path).name}.rels')
    if rels_path not in archive.namelist():
        return []
    rel_root = ET.fromstring(archive.read(rels_path))
    relationships = {
        rel.attrib.get('Id', ''): resolve_zip_path(sheet_path, rel.attrib.get('Target', ''))
        for rel in rel_root.findall('pkgrel:Relationship', SPREADSHEET_NS)
    }
    sheet_root = ET.fromstring(archive.read(sheet_path))
    paths = []
    for drawing in sheet_root.findall('main:drawing', SPREADSHEET_NS):
        rel_id = drawing.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id', '')
        path = relationships.get(rel_id)
        if path:
            paths.append(path)
    return paths


def extract_sheet_images(archive: zipfile.ZipFile, sheet_path: str, image_stamp: str):
    row_images = {}
    asset_dir = IMAGE_DIR / image_stamp
    asset_dir.mkdir(parents=True, exist_ok=True)

    for drawing_path in read_sheet_drawing_paths(archive, sheet_path):
        drawing_rels_path = resolve_zip_path(drawing_path, f'_rels/{Path(drawing_path).name}.rels')
        drawing_rels = {}
        if drawing_rels_path in archive.namelist():
            rel_root = ET.fromstring(archive.read(drawing_rels_path))
            drawing_rels = {
                rel.attrib.get('Id', ''): resolve_zip_path(drawing_path, rel.attrib.get('Target', ''))
                for rel in rel_root.findall('pkgrel:Relationship', SPREADSHEET_NS)
            }

        drawing_root = ET.fromstring(archive.read(drawing_path))
        anchors = drawing_root.findall('xdr:oneCellAnchor', SPREADSHEET_NS) + drawing_root.findall('xdr:twoCellAnchor', SPREADSHEET_NS)
        for anchor in anchors:
            marker = anchor.find('xdr:from', SPREADSHEET_NS)
            if marker is None:
                continue
            row_node = marker.find('xdr:row', SPREADSHEET_NS)
            col_node = marker.find('xdr:col', SPREADSHEET_NS)
            if row_node is None or col_node is None:
                continue

            row_idx = int(row_node.text or '0') + 1
            col_idx = int(col_node.text or '0') + 1

            blip = anchor.find('.//a:blip', SPREADSHEET_NS)
            if blip is None:
                continue
            rel_id = blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed', '')
            media_path = drawing_rels.get(rel_id)
            if not media_path or media_path not in archive.namelist():
                continue

            ext = Path(media_path).suffix.lower() or '.png'
            filename = f'r{row_idx:03d}-c{col_idx:03d}{ext}'
            output_path = asset_dir / filename
            output_path.write_bytes(archive.read(media_path))
            public_path = f'/manager-specials-images/{image_stamp}/{filename}'
            row_images.setdefault(row_idx, []).append((col_idx, public_path))

    for row_idx, entries in row_images.items():
        entries.sort(key=lambda item: item[0])
        row_images[row_idx] = [path for _, path in entries]
    return row_images


def build_card(item):
    collection = html.escape(item['collection'])
    includes = html.escape(item['includes'])
    img = html.escape(item['img'])
    qty = html.escape(item['qty'])

    media = (
        f'<img src="{img}" alt="{collection}" style="width: 100%; height: auto; display: block; border: 0;" />'
        if img else
        '<div style="aspect-ratio: 4 / 3; background: linear-gradient(135deg, #f3f4f6, #e5e7eb); display: flex; align-items: center; justify-content: center; color: #6b7280; font-weight: 800; letter-spacing: .03em;">IMAGE NEEDED</div>'
    )

    return (
        '  <td width="50%" valign="top" style="padding: 8px;">'
        '<table class="ms-card" data-reg="{reg}" data-now="{now}" data-off="{off}" data-qty="{qty_raw}" data-badge="{badge_raw}" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">'
        '<tbody>'
        '<tr>'
        '<td style="padding: 0;">'
        '<div style="position: relative;">'
        '{media}'
        '<div class="ms-badge" style="position: absolute; top: 10px; left: 10px; background: #111827; color: #fff; font-weight: 900; border-radius: 999px; padding: 6px 10px; font-size: 12px; letter-spacing: .04em;">Clearance</div>'
        '<div class="ms-offbadge" style="position: absolute; top: 10px; right: 10px; background: #b45309; color: #fff; font-weight: 900; border-radius: 999px; padding: 8px 14px; font-size: 14px; letter-spacing: .04em; box-shadow: 0 6px 14px rgba(0,0,0,.18);"></div>'
        '<div style="position: absolute; left: 0; bottom: 0; background: #ffffff; color: #111827; font-weight: 900; font-size: 14px; padding: 6px 10px; border-top-right-radius: 8px;">{collection}</div>'
        '</div>'
        '</td>'
        '</tr>'
        '<tr>'
        '<td style="padding: 10px 12px 14px;">'
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">'
        '<tbody>'
        '<tr>'
        '<td valign="top" style="padding-right: 10px;">'
        '<div style="color: #6b7280; font-size: 12px;">Includes: {includes}</div>'
        '<div style="margin-top: 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">'
        '<div class="ms-nowline" style="font-weight: 900; font-size: 13px; color: #111827;"></div>'
        '<div style="color: #374151; font-size: 13px;">Was <span class="ms-regline" style="text-decoration: line-through;"></span></div>'
        '</div>'
        '</td>'
        '<td valign="top" style="text-align: right;">'
        '<div style="color: #6b7280; font-size: 12px;">Qty Left: {qty}</div>'
        '<a href="https://www.furnituredistributors.net/Home/Locations" style="display: inline-block; margin-top: 8px; padding: 8px 12px; border-radius: 8px; background: #f3f4f6; color: #111827; text-decoration: none; font-weight: 800; font-size: 12px;">Call Store</a>'
        '</td>'
        '</tr>'
        '</tbody>'
        '</table>'
        '</td>'
        '</tr>'
        '</tbody>'
        '</table></td>'
    ).format(
        reg=item['reg'],
        now=item['now'],
        off=item['off'],
        qty=qty,
        qty_raw=html.escape(item['qty_raw']),
        badge_raw=html.escape(item['badge_raw']),
        media=media,
        collection=collection,
        includes=includes,
    )


def build_cards_table(items):
    rows = []
    for i in range(0, len(items), 2):
        left = build_card(items[i])
        right = build_card(items[i + 1]) if i + 1 < len(items) else '<td width="50%" valign="top" style="padding: 8px;"></td>'
        rows.append('<tr>' + left + right + '</tr>')
    return (
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 6px 0;">'
        '<tbody>'
        + ''.join(rows) +
        '</tbody>'
        '</table>'
    )


def update_page(path: Path, items, updated_at: str):
    content = path.read_text(encoding='utf-8')
    start = content.find(CARD_TABLE_START)
    end = content.find(CARD_TABLE_END, start)
    if start == -1 or end == -1:
        raise ValueError(f'markers not found in {path}')
    stamp = '<div class="ms-updated" style="font-size:12px;color:#6b7280;margin:8px 0 10px;">Updated: ' + html.escape(updated_at) + '</div>'
    insert = CARD_TABLE_START + '\n' + stamp + '\n' + build_cards_table(items) + '\n'
    updated = content[:start] + insert + content[end:]
    path.write_text(updated, encoding='utf-8')


def parse_csv_sections(csv_text: str):
    sections = {}
    current = None
    headers = None
    reader = csv.reader(io.StringIO(csv_text))
    for row in reader:
        if not row:
            continue
        cell0 = clean_text(row[0])
        if cell0 and all((not c.strip()) for c in row[1:]):
            current = normalize_section(cell0)
            sections[current] = {'headers': None, 'rows': []}
            headers = None
            continue
        if current is None:
            continue
        if headers is None:
            headers = row
            sections[current]['headers'] = header_map(headers)
            continue
        if any(c.strip() for c in row):
            sections[current]['rows'].append({'values': row, 'row_number': None, 'images': []})
    return sections


def parse_workbook_sections(workbook_bytes: bytes, image_stamp: str):
    with zipfile.ZipFile(io.BytesIO(workbook_bytes)) as archive:
        sheet_path = first_sheet_path(archive)
        rows = read_sheet_rows(archive, sheet_path)
        row_images = extract_sheet_images(archive, sheet_path, image_stamp)

    sections = {}
    current = None
    headers = None
    for row_number, row in rows:
        if not row:
            continue
        cell0 = clean_text(row[0]) if row else ''
        if cell0 and all((not c.strip()) for c in row[1:]):
            current = normalize_section(cell0)
            sections[current] = {'headers': None, 'rows': []}
            headers = None
            continue
        if current is None:
            continue
        if headers is None:
            headers = row
            sections[current]['headers'] = header_map(headers)
            continue
        if any(c.strip() for c in row):
            sections[current]['rows'].append({
                'values': row,
                'row_number': row_number,
                'images': row_images.get(row_number, []),
            })
    return sections


def items_from_section(section):
    mapping = section['headers'] or {}
    items = []
    for row_entry in section['rows']:
        row = row_entry['values']
        images = row_entry.get('images', [])

        collection = clean_text(get_value(row, mapping, 'collection', 'name', 'sku'), strip_leading_symbols=True)
        includes = clean_text(get_value(row, mapping, 'includes', 'description', 'sku'))
        img = clean_text(get_value(row, mapping, 'img', 'image', 'image url', 'photo', 'photo url'))
        if not img and images:
            img = images[0]
        badge = clean_text(get_value(row, mapping, 'picture badge', 'badge'))
        qty_raw = clean_text(get_value(row, mapping, 'amount left', 'qty', 'quantity'))
        ms_price = clean_text(get_value(row, mapping, 'ms price', 'msprice', 'price', 'sale price'))
        reg_price = clean_text(get_value(row, mapping, 'reg price', 'regprice', 'regular price'))
        disc = clean_text(get_value(row, mapping, 'disc', 'discount'))

        if not any([collection, includes, img]):
            continue

        now = parse_price(ms_price)
        reg = parse_price(reg_price)
        off = parse_price(disc)
        qty = format_qty(qty_raw)

        items.append({
            'collection': collection or 'Special',
            'includes': includes or 'See store for details',
            'img': img,
            'badge': badge,
            'badge_raw': badge,
            'qty': qty,
            'qty_raw': qty_raw,
            'now': now,
            'reg': reg,
            'off': off,
        })
    return items


class Handler(BaseHTTPRequestHandler):
    def send_json(self, code, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/health':
            self.send_json(200, {'status': 'ok'})
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != '/upload-csv':
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get('Content-Length', '0'))
        if length <= 0:
            self.send_json(400, {'error': 'Missing request body'})
            return

        content_type = self.headers.get('Content-Type', '')
        csv_text = ''
        workbook_bytes = b''
        upload_filename = ''
        raw = self.rfile.read(length)

        if 'multipart/form-data' in content_type:
            message = BytesParser(policy=default).parsebytes(
                f'Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n'.encode('utf-8') + raw
            )
            fields = {}
            files = {}
            file_names = {}
            for part in message.iter_parts():
                name = part.get_param('name', header='content-disposition')
                if not name:
                    continue
                payload = part.get_payload(decode=True) or b''
                filename = part.get_filename()
                if filename:
                    files[name] = payload
                    file_names[name] = filename
                else:
                    fields[name] = payload.decode(part.get_content_charset() or 'utf-8', errors='ignore')
            for key in ('file', 'xlsx', 'workbook', 'spreadsheet', 'upload'):
                if key in files:
                    upload_filename = file_names.get(key, '')
                    lower_name = upload_filename.lower()
                    if lower_name.endswith('.csv'):
                        csv_text = files[key].decode('utf-8-sig', errors='ignore')
                    elif lower_name.endswith('.xls') and not lower_name.endswith('.xlsx'):
                        self.send_json(400, {'error': 'Legacy .xls files are not supported here. Please save/export the file as .xlsx or .csv and upload again.'})
                        return
                    else:
                        workbook_bytes = files[key]
                    break
            if not workbook_bytes and not csv_text:
                csv_text = fields.get('csv', '')
        else:
            try:
                payload = json.loads(raw.decode('utf-8'))
                csv_text = payload.get('csv', '')
            except Exception:
                self.send_json(400, {'error': 'Invalid JSON'})
                return

        if not workbook_bytes and not csv_text.strip():
            self.send_json(400, {'error': 'Upload payload is empty'})
            return

        try:
            image_stamp = datetime.now(ZoneInfo('America/New_York')).strftime('%Y%m%d%H%M%S')
            sections = parse_workbook_sections(workbook_bytes, image_stamp) if workbook_bytes else parse_csv_sections(csv_text)
            missing = [name for name in PAGE_MAP.keys() if name not in sections]
            if missing:
                self.send_json(400, {'error': 'Missing sections', 'missing': missing})
                return

            updated_at = datetime.now(ZoneInfo('America/New_York')).strftime('%Y-%m-%d %I:%M %p ET')
            updated = {}
            for section_name, filename in PAGE_MAP.items():
                path = OUTPUT_DIR / filename
                items = items_from_section(sections[section_name])
                update_page(path, items, updated_at)
                updated[section_name] = len(items)

            response = {
                'status': 'ok',
                'updated': {
                    'living room': updated.get('living room', 0),
                    'bedroom': updated.get('bedroom', 0),
                    'dining room': updated.get('dinning room', 0),
                    'recliner': updated.get('recliner', 0),
                },
            }
            self.send_json(200, response)
        except Exception as exc:
            self.send_json(500, {'error': str(exc)})


if __name__ == "__main__":
    bind_host = os.getenv("BIND_HOST", "127.0.0.1")
    bind_port = int(os.getenv("BIND_PORT", "8000"))
    server = HTTPServer((bind_host, bind_port), Handler)
    server.serve_forever()
