import { useState, useEffect } from 'react'
import { Check, X, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getFriendlyErrorMessage } from '../lib/errorHandler'

interface ProductFormProps {
    onClose: () => void
    onSuccess: () => void
}

export default function ProductForm({ onClose, onSuccess }: ProductFormProps) {
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        CodigoProducto: '',
        NombreProducto: '',
        Categoria: '',
        CostoConIVA: '',
        PvpSinIVA: '',
        CalculoIVA: '',
        PrecioVentaConIVA: '',
        IVA: '15' // Porcentaje visual, en BD es 0.15
    })

    // Auto-cálculos básicos si se ingresa Costo o PVP
    useEffect(() => {
        const pvp = parseFloat(formData.PvpSinIVA) || 0
        const ivaPct = (parseFloat(formData.IVA) || 0) / 100

        if (pvp > 0) {
            const calcIva = pvp * ivaPct
            const precioVenta = pvp + calcIva

            setFormData(prev => ({
                ...prev,
                CalculoIVA: calcIva.toFixed(4),
                PrecioVentaConIVA: precioVenta.toFixed(4)
            }))
        }
    }, [formData.PvpSinIVA, formData.IVA])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.CodigoProducto.trim() || !formData.NombreProducto.trim()) {
            alert('El código y nombre del producto son obligatorios.')
            return
        }

        setSaving(true)
        try {
            const { data: userData, error: userError } = await supabase.auth.getUser()
            if (userError || !userData?.user) throw new Error('No se pudo verificar la sesión del usuario.')
            const userId = userData.user.id

            const dataToInsert = {
                CodigoProducto: formData.CodigoProducto.trim().toUpperCase(),
                NombreProducto: formData.NombreProducto.trim(),
                Categoria: formData.Categoria.trim() || 'General',
                CostoConIVA: parseFloat(formData.CostoConIVA) || 0,
                PvpSinIVA: parseFloat(formData.PvpSinIVA) || 0,
                CalculoIVA: parseFloat(formData.CalculoIVA) || 0,
                PrecioVentaConIVA: parseFloat(formData.PrecioVentaConIVA) || 0,
                IVA: (parseFloat(formData.IVA) || 0) / 100,
                user_id: userId
            }

            const { error } = await supabase.from('productos').insert(dataToInsert)

            if (error) {
                // Si el error es unique constraint (Ej: CodigoProducto ya existe para el usuario si hay un unique key)
                throw error
            }

            // También inicializar el inventario para el usuario
            if (userId) {
                await supabase.from('inventario_usuario').insert({
                    user_id: userId,
                    CodigoProducto: dataToInsert.CodigoProducto,
                    CantidadInicial: 0,
                    CantidadVendida: 0,
                    CantidadPrestada: 0,
                    CantidadInventario: 0
                }).select()
            }

            onSuccess()
        } catch (err: any) {
            console.error('Error al guardar producto:', err)
            alert('Error al guardar: ' + getFriendlyErrorMessage(err))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 600, width: '94vw' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Package size={18} style={{ color: 'var(--accent-teal)' }} />
                        Nuevo Producto
                    </h3>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
                        <div className="field">
                            <label>Código Producto *</label>
                            <input
                                required
                                value={formData.CodigoProducto}
                                onChange={e => setFormData({ ...formData, CodigoProducto: e.target.value })}
                                placeholder="Ej: PROD-001"
                                style={{ textTransform: 'uppercase' }}
                            />
                        </div>
                        <div className="field">
                            <label>Nombre *</label>
                            <input
                                required
                                value={formData.NombreProducto}
                                onChange={e => setFormData({ ...formData, NombreProducto: e.target.value })}
                                placeholder="Ej: Camisa Azul"
                            />
                        </div>
                        <div className="field">
                            <label>Categoría</label>
                            <input
                                value={formData.Categoria}
                                onChange={e => setFormData({ ...formData, Categoria: e.target.value })}
                                placeholder="Ej: Ropa"
                            />
                        </div>
                        <div className="field">
                            <label>IVA (%) *</label>
                            <input
                                type="number" step="0.01" min="0" required
                                value={formData.IVA}
                                onChange={e => setFormData({ ...formData, IVA: e.target.value })}
                            />
                        </div>
                        <div className="field">
                            <label>Costo con IVA</label>
                            <input
                                type="number" step="0.01" min="0"
                                value={formData.CostoConIVA}
                                onChange={e => setFormData({ ...formData, CostoConIVA: e.target.value })}
                            />
                        </div>
                        <div className="field">
                            <label>PVP sin IVA</label>
                            <input
                                type="number" step="0.01" min="0"
                                value={formData.PvpSinIVA}
                                onChange={e => setFormData({ ...formData, PvpSinIVA: e.target.value })}
                            />
                        </div>
                        <div className="field">
                            <label>Cálculo IVA</label>
                            <input
                                type="number" step="0.01"
                                value={formData.CalculoIVA}
                                onChange={e => setFormData({ ...formData, CalculoIVA: e.target.value })}
                            />
                        </div>
                        <div className="field">
                            <label>Precio Venta con IVA</label>
                            <input
                                type="number" step="0.01"
                                value={formData.PrecioVentaConIVA}
                                onChange={e => setFormData({ ...formData, PrecioVentaConIVA: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Guardando...' : <><Check size={14} /> Guardar Producto</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
