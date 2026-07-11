import importlib.util
import pathlib
import unittest
from datetime import date

MODULE_PATH = pathlib.Path(__file__).with_name("import_pos_xlsx.py")
spec = importlib.util.spec_from_file_location("import_pos_xlsx", MODULE_PATH)
assert spec is not None
import_pos_xlsx = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(import_pos_xlsx)


class FakeCursor:
    def __init__(self, count=0):
        self.count = count
        self.calls = []
        self.rowcount = 0

    def execute(self, sql, params=None):
        self.calls.append((sql, params))
        if sql.lstrip().upper().startswith("DELETE"):
            self.rowcount = self.count

    def fetchone(self):
        return (self.count,)


class ItemReconciliationTests(unittest.TestCase):
    def test_expected_date_field_for_basis(self):
        self.assertEqual(import_pos_xlsx.expected_date_field_for_basis("written"), "sale_date")
        self.assertEqual(import_pos_xlsx.expected_date_field_for_basis("delivered"), "delivery_confirmed_date")

    def test_reconciliation_refuses_unknown_date_field(self):
        cur = FakeCursor(count=0)
        with self.assertRaises(ValueError):
            import_pos_xlsx.reconcile_stale_items(
                cur,
                date_basis="written",
                coverage_field="created_at",
                range_start=date(2026, 7, 1),
                range_end=date(2026, 7, 2),
                sale_ids=["S1"],
                incoming_row_count=1,
                dry_run=True,
                max_prune_rows=10,
                max_prune_ratio=1.0,
            )
        self.assertEqual(cur.calls, [])

    def test_reconciliation_skips_mismatched_basis_field(self):
        cur = FakeCursor(count=2)
        import_pos_xlsx.reconcile_stale_items(
            cur,
            date_basis="written",
            coverage_field="delivery_confirmed_date",
            range_start=date(2026, 7, 1),
            range_end=date(2026, 7, 2),
            sale_ids=["S1"],
            incoming_row_count=1,
            dry_run=True,
            max_prune_rows=10,
            max_prune_ratio=1.0,
        )
        self.assertEqual(cur.calls, [])

    def test_reconciliation_dry_run_counts_same_basis_window_without_delete(self):
        cur = FakeCursor(count=2)
        import_pos_xlsx.reconcile_stale_items(
            cur,
            date_basis="written",
            coverage_field="sale_date",
            range_start=date(2026, 7, 1),
            range_end=date(2026, 7, 2),
            sale_ids=["S1", "S2"],
            incoming_row_count=10,
            dry_run=True,
            max_prune_rows=10,
            max_prune_ratio=1.0,
        )
        self.assertEqual(len(cur.calls), 1)
        sql, params = cur.calls[0]
        self.assertIn("date_basis = %s", sql)
        self.assertIn("sale_date >= %s", sql)
        self.assertIn("sale_date <= %s", sql)
        self.assertEqual(params, ("written", date(2026, 7, 1), date(2026, 7, 2), ["S1", "S2"]))

    def test_reconciliation_threshold_stops_before_delete(self):
        cur = FakeCursor(count=11)
        with self.assertRaises(RuntimeError):
            import_pos_xlsx.reconcile_stale_items(
                cur,
                date_basis="delivered",
                coverage_field="delivery_confirmed_date",
                range_start=date(2026, 7, 1),
                range_end=date(2026, 7, 2),
                sale_ids=["S1"],
                incoming_row_count=100,
                dry_run=False,
                max_prune_rows=10,
                max_prune_ratio=1.0,
            )
        self.assertEqual(len(cur.calls), 1)
        self.assertFalse(any(call[0].lstrip().upper().startswith("DELETE") for call in cur.calls))

    def test_reconciliation_delete_is_same_basis_and_bounded(self):
        cur = FakeCursor(count=1)
        import_pos_xlsx.reconcile_stale_items(
            cur,
            date_basis="delivered",
            coverage_field="delivery_confirmed_date",
            range_start=date(2026, 7, 1),
            range_end=date(2026, 7, 2),
            sale_ids=["S1"],
            incoming_row_count=10,
            dry_run=False,
            max_prune_rows=10,
            max_prune_ratio=1.0,
        )
        self.assertEqual(len(cur.calls), 2)
        delete_sql, delete_params = cur.calls[1]
        self.assertTrue(delete_sql.lstrip().upper().startswith("DELETE FROM POS_SALE_ITEMS"))
        self.assertIn("date_basis = %s", delete_sql)
        self.assertIn("delivery_confirmed_date >= %s", delete_sql)
        self.assertIn("delivery_confirmed_date <= %s", delete_sql)
        self.assertEqual(delete_params, ("delivered", date(2026, 7, 1), date(2026, 7, 2), ["S1"]))


if __name__ == "__main__":
    unittest.main()
