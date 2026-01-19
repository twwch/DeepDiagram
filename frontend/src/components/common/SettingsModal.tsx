import React, { useState } from 'react';
import { X, Save, Shield, Info, Plus, Trash2, Edit2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';
import type { ModelConfig } from '../../store/settingsStore';
import { cn } from '../../lib/utils';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { models, activeModelId, addModel, removeModel, updateModel, setActiveModelId } = useSettingsStore();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [form, setForm] = useState<Omit<ModelConfig, 'id'>>({
        name: '',
        modelId: '',
        apiKey: '',
        baseUrl: ''
    });

    if (!isOpen) return null;

    const resetForm = () => {
        setForm({ name: '', modelId: '', apiKey: '', baseUrl: '' });
        setEditingId(null);
        setIsAdding(false);
        setTestResult(null);
    };

    const testModelConnection = async (): Promise<boolean> => {
        setIsTesting(true);
        setTestResult(null);

        try {
            const response = await fetch('/api/test-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: form.modelId.trim(),
                    api_key: form.apiKey.trim(),
                    base_url: form.baseUrl.trim()
                })
            });

            const result = await response.json();
            setTestResult(result);
            return result.success;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Connection test failed';
            setTestResult({ success: false, message: errorMsg });
            return false;
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        if (!form.name || !form.modelId || !form.apiKey || !form.baseUrl) return;

        // Test connection before saving
        const isValid = await testModelConnection();
        if (!isValid) {
            return; // Don't save if test fails
        }

        const trimmedForm = {
            name: form.name.trim(),
            modelId: form.modelId.trim(),
            apiKey: form.apiKey.trim(),
            baseUrl: form.baseUrl.trim()
        };

        if (editingId) {
            updateModel(editingId, trimmedForm);
            setTestResult({ success: true, message: '配置更新成功！' });
        } else {
            addModel(trimmedForm);
            setTestResult({ success: true, message: '模型添加成功！' });
        }

        // Show success message briefly, then reset form
        setTimeout(() => {
            resetForm();
        }, 1500);
    };

    const startEdit = (model: ModelConfig) => {
        setForm({
            name: model.name,
            modelId: model.modelId,
            apiKey: model.apiKey,
            baseUrl: model.baseUrl
        });
        setEditingId(model.id);
        setIsAdding(true);
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                            <Shield className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">Model Configurations</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200/50 rounded-full text-slate-400 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
                        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-700 leading-relaxed">
                            Configure multiple LLM providers. Your API keys are stored solely in your browser's local storage.
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Your Models</h3>
                            {!isAdding && (
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-full text-[10px] font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 active:scale-95"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add New</span>
                                </button>
                            )}
                        </div>

                        {models.length === 0 && !isAdding ? (
                            <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl">
                                <p className="text-sm text-slate-400">No custom models configured yet.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {models.map((model) => (
                                    <div
                                        key={model.id}
                                        className={cn(
                                            "group p-4 rounded-2xl border transition-all flex items-center justify-between",
                                            activeModelId === model.id
                                                ? "bg-blue-50/50 border-blue-200 shadow-sm"
                                                : "bg-white border-slate-100 hover:border-slate-200",
                                            editingId === model.id && "ring-2 ring-blue-500 ring-offset-2"
                                        )}
                                    >
                                        <div
                                            className="flex-1 cursor-pointer"
                                            onClick={() => setActiveModelId(model.id)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-700 text-sm">{model.name}</span>
                                                {activeModelId === model.id && (
                                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[9px] font-black uppercase">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono truncate max-w-[200px]">
                                                {model.modelId} • {model.baseUrl}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => startEdit(model)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => removeModel(model.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                title="Remove"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {isAdding && (
                            <div className="pt-6 border-t border-slate-100 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest px-1">
                                        {editingId ? 'Edit Model' : 'New Configuration'}
                                    </h3>
                                    <button
                                        onClick={resetForm}
                                        className="text-xs font-bold text-slate-400 hover:text-slate-600"
                                    >
                                        Cancel
                                    </button>
                                </div>

                                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                                            Configuration Name
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. My Claude 3.7"
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-semibold"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                                            Provider Base URL
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="https://api.anthropic.com/v1"
                                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                            value={form.baseUrl}
                                            onChange={(e) => { setForm({ ...form, baseUrl: e.target.value }); setTestResult(null); }}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                                                Model ID
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="claude-3-7-sonnet..."
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                value={form.modelId}
                                                onChange={(e) => { setForm({ ...form, modelId: e.target.value }); setTestResult(null); }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                                                API Key
                                            </label>
                                            <input
                                                type="password"
                                                placeholder="sk-..."
                                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                                                value={form.apiKey}
                                                onChange={(e) => { setForm({ ...form, apiKey: e.target.value }); setTestResult(null); }}
                                            />
                                        </div>
                                    </div>

                                    {/* Test Result Message */}
                                    {testResult && (
                                        <div className={cn(
                                            "p-3 rounded-xl flex items-center gap-2 text-sm animate-in slide-in-from-top-2 duration-200",
                                            testResult.success
                                                ? "bg-green-50 border border-green-200 text-green-700"
                                                : "bg-red-50 border border-red-200 text-red-700"
                                        )}>
                                            {testResult.success ? (
                                                <CheckCircle className="w-4 h-4 shrink-0" />
                                            ) : (
                                                <AlertCircle className="w-4 h-4 shrink-0" />
                                            )}
                                            <span className="font-medium">{testResult.message}</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSave}
                                        disabled={!form.name || !form.modelId || !form.apiKey || !form.baseUrl || isTesting}
                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        {isTesting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>Testing Connection...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4" />
                                                <span>{editingId ? 'Update Configuration' : 'Test & Add Configuration'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Default Fallback:</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Server Config</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
