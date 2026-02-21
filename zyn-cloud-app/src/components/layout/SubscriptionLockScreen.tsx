import { Lock, MessageCircle, Clock, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function SubscriptionLockScreen() {
    const { signOut } = useAuth();

    // Admin details according to requirements
    const adminName = "Justin Gomezcoello";
    const adminPhone = "5930980267544"; // For WA link
    const waMessage = encodeURIComponent("Hola, se me acabó la licencia gratuita de 30 días en ZYN CLOUD. Deseo adquirir la licencia, ¿cómo funciona?");

    const waLink = `https://wa.me/${adminPhone}?text=${waMessage}`;

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background: 'var(--bg-app)',
            color: 'var(--text-main)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                maxWidth: 480,
                width: '100%',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                overflow: 'hidden',
                position: 'relative',
                textAlign: 'center',
                padding: '40px 30px'
            }}>
                {/* Decoration blob */}
                <div style={{
                    position: 'absolute',
                    top: -50,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 150,
                    height: 150,
                    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0) 70%)',
                    zIndex: 0
                }}></div>

                <div style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 20
                }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-amber)',
                        marginBottom: 10
                    }}>
                        <Lock size={32} />
                    </div>

                    <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#fff' }}>
                        Licencia Expirada
                    </h2>

                    <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                        Tu período de prueba gratuito de 30 días ha finalizado. Para seguir utilizando <strong>ZYN CLOUD</strong> y todas sus herramientas sin interrupciones, necesitas adquirir la licencia.
                    </p>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: 'rgba(56, 189, 248, 0.05)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        padding: '16px 20px',
                        borderRadius: 'var(--radius-md)',
                        width: '100%',
                        textAlign: 'left'
                    }}>
                        <Clock size={20} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-blue)' }}>¿Cómo adquirir la licencia?</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Comunícate directamente con el administrador para conocer los planes y continuar con tu negocio.</div>
                        </div>
                    </div>

                    <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="btn"
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                            background: '#25D366',
                            color: '#fff',
                            border: 'none',
                            fontWeight: 700,
                            padding: '12px 20px',
                            marginTop: 10,
                            boxShadow: '0 4px 14px rgba(37, 211, 102, 0.3)',
                            textDecoration: 'none'
                        }}
                    >
                        <MessageCircle size={18} />
                        Contactar a {adminName} <ExternalLink size={14} style={{ marginLeft: 'auto', opacity: 0.8 }} />
                    </a>

                    <div style={{ width: '100%', height: 1, background: 'var(--border)', margin: '10px 0' }}></div>

                    <button
                        onClick={signOut}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: 14,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                        Cerrar sesión
                    </button>
                </div>
            </div>
        </div>
    );
}

