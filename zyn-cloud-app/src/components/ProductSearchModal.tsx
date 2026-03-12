import { useState, useEffect, useMemo } from 'react'
import { Search, X, Package, Clipboard, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface ProductSearchModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function ProductSearchModal({ isOpen, onClose }: ProductSearchModalProps) {
    const { user } = useAuth()
    const [searchTerm, setSearchTerm] = useState('')
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

    // Load user products once when modal opens to perform fast local filtering
    useEffect(() => {
        if (!isOpen || !user) return

        let mounted = true
        setLoading(true)

        async function fetchProducts() {
            try {
                const { data, error } = await supabase
                    .from('productos')
                    .select('CodigoProducto, NombreProducto, Categoria')
                    .eq('user_id', user!.id)
                    .order('NombreProducto', { ascending: true })

                if (error) throw error
                if (mounted && data) {
                    setProducts(data)
                }
            } catch (err) {
                console.error("Error fetching products for search:", err)
            } finally {
                if (mounted) setLoading(false)
            }
        }

        fetchProducts()

        return () => {
            mounted = false
            setSearchTerm('')
            setCopiedCode(null)
        }
    }, [isOpen, user])

    const filteredProducts = useMemo(() => {
        if (!searchTerm.trim()) return products
        const term = searchTerm.toLowerCase()
        return products.filter(p =>
            p.NombreProducto.toLowerCase().includes(term) ||
            p.CodigoProducto.toLowerCase().includes(term) ||
            (p.Categoria && p.Categoria.toLowerCase().includes(term))
        )
    }, [products, searchTerm])

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code)
        setCopiedCode(code)
        setTimeout(() => setCopiedCode(null), 2000)
    }

    if (!isOpen) return null

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999, alignItems: 'flex-start', paddingTop: '10vh' }}>
            <div className="modal-box" style={{ maxWidth: 600, width: '94vw', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

                {/* Search Header */}
                <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}>
                    <div style={{ padding: '0 16px', color: 'var(--text-secondary)' }}>
                        <Search size={20} />
                    </div>
                    <input
                        autoFocus
                        placeholder="Buscar producto por nombre, código o categoría..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            flex: 1,
                            border: 'none',
                            background: 'transparent',
                            padding: '16px 0',
                            fontSize: '1.1rem',
                            outline: 'none',
                            color: 'var(--text-color)'
                        }}
                    />
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '16px',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Results Area */}
                <div style={{ maxHeight: '60vh', overflowY: 'auto', backgroundColor: 'var(--background-color)', padding: '12px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                            <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
                            Cargando tu catálogo...
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                            <Package size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
                            <p>No se encontraron productos que coincidan con "{searchTerm}".</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0 8px 8px' }}>
                                Resultados ({filteredProducts.length}) - Haz clic para copiar el código
                            </div>
                            {filteredProducts.map(p => (
                                <div
                                    key={p.CodigoProducto}
                                    onClick={() => handleCopy(p.CodigoProducto)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px 16px',
                                        backgroundColor: 'var(--surface-color)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-teal)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                >
                                    <div>
                                        <div style={{ fontWeight: '500', color: 'var(--text-color)', marginBottom: '4px' }}>
                                            {p.NombreProducto}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            <span style={{
                                                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                                                color: 'var(--accent-teal)',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontWeight: '600'
                                            }}>
                                                {p.CodigoProducto}
                                            </span>
                                            {p.Categoria && <span>• {p.Categoria}</span>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: copiedCode === p.CodigoProducto ? 'rgba(74, 222, 128, 0.1)' : 'var(--background-color)' }}>
                                        {copiedCode === p.CodigoProducto ? (
                                            <Check size={16} color="var(--success-color)" />
                                        ) : (
                                            <Clipboard size={16} color="var(--text-secondary)" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
