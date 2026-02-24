function getFriendlyErrorMessage(error) {
    if (!error) return 'Ocurrió un error desconocido. Intente nuevamente.';

    const msg = (error.message || error.toString() || '').toLowerCase();

    if (msg.includes('schema cache') || msg.includes('could not find the table') || msg.includes('column') || msg.includes('relation')) {
        return 'Error de sincronización con la base de datos. Por favor, recargue la página o informe a soporte.';
    }

    if (msg.includes('duplicate key') || msg.includes('unique constraint')) return '...';
    if (msg.includes('violates not-null') || msg.includes('null value in column')) return '...';
    if (msg.includes('foreign key constraint') || msg.includes('violates foreign key')) return '...';
    if (msg.includes('jwt expired') || msg.includes('invalid claim')) return '...';
    if (msg.includes('invalid login credentials')) return '...';
    if (msg.includes('user not found')) return '...';
    if (msg.includes('not valid') && msg.includes('password')) return '...';
    if (msg.includes('fetch') || msg.includes('network error') || msg.includes('failed to fetch')) return '...';

    if (msg.includes('postgrest') || msg.includes('postgres') || msg.includes('sql') || msg.length > 80) {
        return 'Ocurrió un error interno en el servidor. Intente más tarde o comuníquese con soporte.';
    }

    return error.message || 'Error inesperado. Contacte a soporte si el problema persiste.';
}

const err = new Error('No se encontró la Orden de Compra Nº 123 o no aplica para este usuario.');
console.log("Original Message:", err.message);
console.log("Output:", getFriendlyErrorMessage(err));
