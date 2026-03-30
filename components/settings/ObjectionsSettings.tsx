import React, { useEffect, useState } from "react";
import { Trash2, Edit2, Plus, Check, X, AlertCircle } from "lucide-react";
import {
  fetchCustomObjections,
  createCustomObjection,
  updateCustomObjection,
  deleteCustomObjection,
  type CustomObjection,
} from "../../services/customObjectionsApi";

const ObjectionsSettings: React.FC = () => {
  const [objections, setObjections] = useState<CustomObjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [editLabel, setEditLabel] = useState("");
  const [editRebuttals, setEditRebuttals] = useState<string[]>([]);

  const loadObjections = async () => {
    try {
      const data = await fetchCustomObjections();
      setObjections(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadObjections();
  }, []);

  const handleStartEdit = (obj: CustomObjection) => {
    setEditingId(obj.id);
    setEditLabel(obj.label);
    setEditRebuttals([...obj.rebuttals, "", "", "", ""].slice(0, 5));
    setIsAdding(false);
  };

  const handleStartAdd = () => {
    setEditingId(null);
    setEditLabel("");
    setEditRebuttals(["", "", "", "", ""]);
    setIsAdding(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setEditLabel("");
    setEditRebuttals([]);
  };

  const handleSave = async () => {
    if (!editLabel.trim()) return;
    const validRebuttals = editRebuttals.filter((r) => r.trim());
    if (validRebuttals.length === 0) return;

    try {
      if (isAdding) {
        await createCustomObjection({
          label: editLabel.trim(),
          rebuttals: validRebuttals,
        });
      } else if (editingId) {
        await updateCustomObjection(editingId, {
          label: editLabel.trim(),
          rebuttals: validRebuttals,
        });
      }
      await loadObjections();
      handleCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this objection?")) return;
    try {
      await deleteCustomObjection(id);
      await loadObjections();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const handleRebuttalChange = (idx: number, value: string) => {
    const newRebuttals = [...editRebuttals];
    newRebuttals[idx] = value;
    setEditRebuttals(newRebuttals);
  };

  if (loading) {
    return <div className="p-6 text-slate-500">Loading objections...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Custom Objections</h3>
          <p className="text-sm text-slate-500">Manage objections submitted by your team</p>
        </div>
        {!isAdding && editingId === null && (
          <button
            onClick={handleStartAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
          >
            <Plus size={16} />
            Add Objection
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {(isAdding || editingId !== null) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Objection Label</label>
            <input
              type="text"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="e.g., It's too expensive"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rebuttals</label>
            <div className="space-y-2">
              {editRebuttals.map((r, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={r}
                  onChange={(e) => handleRebuttalChange(idx, e.target.value)}
                  placeholder={`Rebuttal ${idx + 1}`}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!editLabel.trim() || editRebuttals.filter((r) => r.trim()).length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              <Check size={16} />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-100"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {objections.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No custom objections yet. Submit one from the Objections Drawer or click Add Objection.
          </div>
        ) : (
          objections.map((obj) => (
            <div
              key={obj.id}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      Custom
                    </span>
                    {editingId !== obj.id && (
                      <span className="text-sm font-medium text-slate-800">{obj.label}</span>
                    )}
                  </div>
                  {editingId !== obj.id && obj.rebuttals.length > 0 && (
                    <div className="text-xs text-slate-500 space-y-1">
                      {obj.rebuttals.slice(0, 3).map((r, idx) => (
                        <div key={idx} className="truncate">• {r}</div>
                      ))}
                      {obj.rebuttals.length > 3 && (
                        <div className="text-slate-400">+{obj.rebuttals.length - 3} more</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStartEdit(obj)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(obj.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ObjectionsSettings;
