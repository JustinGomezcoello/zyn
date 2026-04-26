import { useState, useEffect, useRef } from 'react'
import { Check, X, Package, Upload, FileSpreadsheet, AlertCircle, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getFriendlyErrorMessage } from '../lib/errorHandler'
import * as XLSX from 'xlsx'

interface ProductFormProps {
    onClose: () => void
    onSuccess: () => void
    initialData?: any
}

const REQUIRED_COLUMNS = ['CodigoProducto', 'NombreProducto', 'Categoria', 'CostoConIVA', 'PvpSinIVA', 'IVA']

export default function ProductForm({ onClose, onSuccess, initialData }: ProductFormProps) {
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<'manual' | 'excel'>('manual')
    const [formData, setFormData] = useState({
        CodigoProducto: initialData?.CodigoProducto || '',
        NombreProducto: initialData?.NombreProducto || '',
        Categoria: initialData?.Categoria || '',
        CostoConIVA: initialData?.CostoConIVA?.toString() || '',
        PvpSinIVA: initialData?.PvpSinIVA?.toString() || '',
        CalculoIVA: initialData?.CalculoIVA?.toString() || '',
        PrecioVentaConIVA: initialData?.PrecioVentaConIVA?.toString() || '',
        IVA: initialData?.IVA !== undefined ? (Number(initialData.IVA) * 100).toString() : '15'
    })

    // Excel state
    const [excelData, setExcelData] = useState<any[]>([])
    const [excelErrors, setExcelErrors] = useState<string[]>([])
    const [excelFileName, setExcelFileName] = useState('')
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Auto-cálculos básicos si se ingresa Costo o PVP
    useEffect(() => {
        const pvp = parseFloat(formData.PvpSinIVA) || 0
        const ivaPct = (parseFloat(formData.IVA) || 0) / 100

        if (pvp > 0) {
            const calcIva = pvp * ivaPct
            const precioVenta = pvp + calcIva

            setFormData(prev => ({
                ...prev,
                CalculoIVA: calcIva.toFixed(2),
                PrecioVentaConIVA: precioVenta.toFixed(2)
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

            const dataToUpsert = {
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

            if (initialData) {
                const { error } = await supabase.from('productos')
                    .update(dataToUpsert)
                    .eq('CodigoProducto', initialData.CodigoProducto)
                    .eq('user_id', userId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('productos').insert(dataToUpsert)
                if (error) throw error

                if (userId) {
                    await supabase.from('inventario_usuario').insert({
                        user_id: userId,
                        CodigoProducto: dataToUpsert.CodigoProducto,
                        CantidadInicial: 0,
                        CantidadVendida: 0,
                        CantidadPrestada: 0,
                        CantidadInventario: 0
                    }).select()
                }
            }

            onSuccess()
        } catch (err: any) {
            console.error('Error al guardar producto:', err)
            alert('Error al guardar: ' + getFriendlyErrorMessage(err))
        } finally {
            setSaving(false)
        }
    }

    /* ── EXCEL ─────────────────────────────────────────── */
    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            REQUIRED_COLUMNS,
            ['E001', 'Producto de Ejemplo', 'General', 100, 85, 15],
            ['E002', 'Segundo Producto', 'Salud', 50, 42, 15],
        ])
        const colWidths = REQUIRED_COLUMNS.map(c => ({ wch: Math.max(c.length + 4, 18) }))
        ws['!cols'] = colWidths
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Productos')
        XLSX.writeFile(wb, 'plantilla_productos_zyn.xlsx')
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setExcelFileName(file.name)
        setExcelErrors([])
        setExcelData([])

        const reader = new FileReader()
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target?.result as ArrayBuffer)
                const wb = XLSX.read(data, { type: 'array' })
                const ws = wb.Sheets[wb.SheetNames[0]]
                const rawJsonData = XLSX.utils.sheet_to_json<any>(ws, { defval: '' })

                if (rawJsonData.length === 0) {
                    setExcelErrors(['El archivo está vacío o no tiene datos.'])
                    return
                }

                // Clean all keys (trim whitespace)
                const jsonData = rawJsonData.map((row: any) => {
                    const newRow: any = {}
                    Object.keys(row).forEach(k => {
                        newRow[k.trim()] = row[k]
                    })
                    return newRow
                })

                // Validate columns
                const headers = Object.keys(jsonData[0])
                const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c))
                if (missing.length > 0) {
                    setExcelErrors([
                        `Columnas faltantes: ${missing.join(', ')}`,
                        `Tu archivo tiene: ${headers.join(', ')}`,
                        `Las columnas deben llamarse EXACTAMENTE: ${REQUIRED_COLUMNS.join(', ')}`
                    ])
                    return
                }

                // Validate each row
                const errors: string[] = []
                const validRows: any[] = []
                jsonData.forEach((row: any, idx: number) => {
                    const rowNum = idx + 2 // +2 because row 1 is the header
                    if (!row.CodigoProducto || String(row.CodigoProducto).trim() === '') {
                        errors.push(`Fila ${rowNum}: CodigoProducto está vacío.`)
                        return
                    }
                    if (!row.NombreProducto || String(row.NombreProducto).trim() === '') {
                        errors.push(`Fila ${rowNum}: NombreProducto está vacío.`)
                        return
                    }
                    const iva = parseFloat(row.IVA)
                    if (isNaN(iva) || iva < 0 || iva > 100) {
                        errors.push(`Fila ${rowNum}: IVA debe ser un número entre 0 y 100 (ej: 15). Valor actual: "${row.IVA}"`)
                        return
                    }
                    const costo = parseFloat(row.CostoConIVA)
                    if (isNaN(costo) || costo < 0) {
                        errors.push(`Fila ${rowNum}: CostoConIVA debe ser un número positivo. Valor actual: "${row.CostoConIVA}"`)
                        return
                    }
                    const pvp = parseFloat(row.PvpSinIVA)
                    if (isNaN(pvp) || pvp < 0) {
                        errors.push(`Fila ${rowNum}: PvpSinIVA debe ser un número positivo. Valor actual: "${row.PvpSinIVA}"`)
                        return
                    }
                    validRows.push(row)
                })

                // Check for duplicate codes in the file
                const codes = validRows.map(r => String(r.CodigoProducto).trim().toUpperCase())
                const dupes = codes.filter((c, i) => codes.indexOf(c) !== i)
                if (dupes.length > 0) {
                    errors.push(`Códigos duplicados en el archivo: ${[...new Set(dupes)].join(', ')}`)
                }

                if (errors.length > 0) {
                    setExcelErrors(errors)
                    return
                }

                setExcelData(validRows)
            } catch {
                setExcelErrors(['No se pudo leer el archivo. Asegúrate de que sea un archivo .xlsx o .xls válido.'])
            }
        }
        reader.readAsArrayBuffer(file)
    }

    const handleBulkUpload = async () => {
        if (excelData.length === 0) return
        setUploading(true)
        setUploadProgress(0)

        try {
            const { data: userData, error: userError } = await supabase.auth.getUser()
            if (userError || !userData?.user) throw new Error('No se pudo verificar la sesión del usuario.')
            const userId = userData.user.id

            let successCount = 0
            const failedRows: string[] = []

            for (let i = 0; i < excelData.length; i++) {
                const row = excelData[i]
                const ivaPct = parseFloat(row.IVA) / 100
                const pvp = parseFloat(row.PvpSinIVA)
                const calculoIVA = pvp * ivaPct
                const precioVenta = pvp + calculoIVA

                const product = {
                    CodigoProducto: String(row.CodigoProducto).trim().toUpperCase(),
                    NombreProducto: String(row.NombreProducto).trim(),
                    Categoria: String(row.Categoria || 'General').trim(),
                    CostoConIVA: parseFloat(row.CostoConIVA) || 0,
                    PvpSinIVA: pvp,
                    CalculoIVA: parseFloat(calculoIVA.toFixed(4)),
                    PrecioVentaConIVA: parseFloat(precioVenta.toFixed(4)),
                    IVA: ivaPct,
                    user_id: userId
                }

                const { error } = await supabase.from('productos').insert(product)
                if (error) {
                    failedRows.push(`${product.CodigoProducto}: ${getFriendlyErrorMessage(error)}`)
                } else {
                    // Initialize inventory
                    await supabase.from('inventario_usuario').insert({
                        user_id: userId,
                        CodigoProducto: product.CodigoProducto,
                        CantidadInicial: 0,
                        CantidadVendida: 0,
                        CantidadPrestada: 0,
                        CantidadInventario: 0
                    }).select()
                    successCount++
                }

                setUploadProgress(Math.round(((i + 1) / excelData.length) * 100))
            }

            if (failedRows.length > 0) {
                setExcelErrors([
                    `✅ ${successCount} productos subidos.`,
                    `❌ ${failedRows.length} producto(s) fallaron:`,
                    ...failedRows
                ])
                if (successCount > 0) {
                    // Partial success, still reload
                    setTimeout(() => onSuccess(), 2000)
                }
            } else {
                onSuccess()
            }
        } catch (err: any) {
            setExcelErrors([`Error general: ${err.message}`])
        } finally {
            setUploading(false)
        }
    }

    /* ── STYLES ─────────────────────────────────────── */
    const solidBg = 'var(--bg-primary)'
    const tabStyle = (isActive: boolean): React.CSSProperties => ({
        flex: 1,
        padding: '10px 16px',
        border: 'none',
        background: isActive ? 'var(--accent-teal)' : 'transparent',
        color: isActive ? '#fff' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '13px',
        fontWeight: 600,
        borderRadius: '8px',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px'
    })

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-box"
                style={{
                    maxWidth: 660,
                    width: '96vw',
                    background: solidBg,
                    border: '1px solid var(--border)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Package size={18} style={{ color: 'var(--accent-teal)' }} />
                        {initialData ? 'Editar Producto' : 'Gestionar Productos'}
                    </h3>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
                </div>

                {/* Tabs (only for new, not edit) */}
                {!initialData && (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--bg-card)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border)' }}>
                        <button type="button" style={tabStyle(activeTab === 'manual')} onClick={() => setActiveTab('manual')}>
                            <Package size={14} />
                            Producto Individual
                        </button>
                        <button type="button" style={tabStyle(activeTab === 'excel')} onClick={() => setActiveTab('excel')}>
                            <FileSpreadsheet size={14} />
                            Subir Excel (Masivo)
                        </button>
                    </div>
                )}

                {/* ═══ TAB: MANUAL ═══ */}
                {(activeTab === 'manual' || initialData) && (
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
                                    disabled={!!initialData}
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
                                <label>Categoría *</label>
                                <input
                                    required
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
                                <label>Costo con IVA *</label>
                                <input
                                    required
                                    type="number" step="0.01" min="0"
                                    value={formData.CostoConIVA}
                                    onChange={e => setFormData({ ...formData, CostoConIVA: e.target.value })}
                                />
                            </div>
                            <div className="field">
                                <label>PVP sin IVA *</label>
                                <input
                                    required
                                    type="number" step="0.01" min="0"
                                    value={formData.PvpSinIVA}
                                    onChange={e => setFormData({ ...formData, PvpSinIVA: e.target.value })}
                                />
                            </div>
                            <div className="field">
                                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Cálculo IVA</span>
                                    <span style={{ fontSize: 10, color: 'var(--accent-teal)' }}>(Automático)</span>
                                </label>
                                <input
                                    type="number" step="0.01"
                                    value={formData.CalculoIVA}
                                    readOnly
                                    className="readonly"
                                    style={{ background: 'var(--bg-card)', opacity: 0.8, cursor: 'not-allowed', color: 'var(--accent-teal)', fontWeight: 'bold' }}
                                    onChange={e => setFormData({ ...formData, CalculoIVA: e.target.value })}
                                />
                            </div>
                            <div className="field">
                                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Precio Venta con IVA</span>
                                    <span style={{ fontSize: 10, color: 'var(--accent-teal)' }}>(Automático)</span>
                                </label>
                                <input
                                    type="number" step="0.01"
                                    value={formData.PrecioVentaConIVA}
                                    readOnly
                                    className="readonly"
                                    style={{ background: 'var(--bg-card)', opacity: 0.8, cursor: 'not-allowed', color: 'var(--accent-teal)', fontWeight: 'bold' }}
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
                )}

                {/* ═══ TAB: EXCEL ═══ */}
                {activeTab === 'excel' && !initialData && (
                    <div>
                        {/* Instructions */}
                        <div style={{
                            background: 'rgba(59, 130, 246, 0.08)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            borderRadius: '10px',
                            padding: 16,
                            marginBottom: 20
                        }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '13px', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertCircle size={14} />
                                Formato requerido del Excel
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                Tu archivo <strong>.xlsx</strong> debe tener estas columnas <strong>exactas</strong> en la primera fila:
                            </div>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 6,
                                marginTop: 8
                            }}>
                                {REQUIRED_COLUMNS.map(c => (
                                    <span key={c} style={{
                                        background: 'rgba(59, 130, 246, 0.15)',
                                        color: 'var(--accent-blue)',
                                        padding: '3px 10px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        fontFamily: 'monospace'
                                    }}>
                                        {c}
                                    </span>
                                ))}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 10 }}>
                                ⚠️ El IVA debe ser en porcentaje (ej: <strong>15</strong> para 15%). El sistema calcula automáticamente CalculoIVA y PrecioVentaConIVA.
                            </div>
                        </div>

                        {/* Download template button */}
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={downloadTemplate}
                            style={{ marginBottom: 16 }}
                        >
                            <Download size={14} />
                            Descargar Plantilla de Ejemplo
                        </button>

                        {/* File upload area */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--border)',
                                borderRadius: '12px',
                                padding: '32px 20px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: 'var(--bg-card)',
                                marginBottom: 16,
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'var(--accent-teal)'
                                e.currentTarget.style.background = 'rgba(0,212,170,0.03)'
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--border)'
                                e.currentTarget.style.background = 'var(--bg-card)'
                            }}
                        >
                            <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {excelFileName || 'Haz clic para seleccionar tu archivo Excel'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
                                Solo formatos .xlsx y .xls
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />
                        </div>

                        {/* Errors */}
                        {excelErrors.length > 0 && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                borderRadius: '8px',
                                padding: 12,
                                marginBottom: 16,
                                maxHeight: '180px',
                                overflowY: 'auto'
                            }}>
                                {excelErrors.map((err, i) => (
                                    <div key={i} style={{ fontSize: '12px', color: err.startsWith('✅') ? 'var(--accent-green)' : 'var(--accent-red)', marginBottom: 4 }}>
                                        {err}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Preview */}
                        {excelData.length > 0 && excelErrors.length === 0 && (
                            <div>
                                <div style={{
                                    background: 'rgba(16, 185, 129, 0.08)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    borderRadius: '8px',
                                    padding: 12,
                                    marginBottom: 16,
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--accent-green)'
                                }}>
                                    ✅ {excelData.length} producto(s) listos para subir
                                </div>

                                <div className="table-wrapper" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: 16 }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                {REQUIRED_COLUMNS.map(c => <th key={c}>{c}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {excelData.slice(0, 10).map((row, i) => (
                                                <tr key={i}>
                                                    <td>{i + 1}</td>
                                                    {REQUIRED_COLUMNS.map(c => (
                                                        <td key={c}>{String(row[c])}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {excelData.length > 10 && (
                                        <div style={{ textAlign: 'center', padding: 8, fontSize: '11px', color: 'var(--text-muted)' }}>
                                            ... y {excelData.length - 10} más
                                        </div>
                                    )}
                                </div>

                                {/* Progress bar */}
                                {uploading && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${uploadProgress}%`,
                                                background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-blue))',
                                                borderRadius: '3px',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginTop: 6 }}>
                                            Subiendo... {uploadProgress}%
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={excelData.length === 0 || uploading || excelErrors.length > 0}
                                onClick={handleBulkUpload}
                            >
                                {uploading ? `Subiendo... ${uploadProgress}%` : <><Upload size={14} /> Subir {excelData.length} Productos</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
