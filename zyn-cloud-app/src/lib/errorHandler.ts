// src/lib/errorHandler.ts

export function getFriendlyErrorMessage(error: any): string {
    if (!error) return 'Ocurrió un error desconocido. Intente nuevamente.';

    const msg = (error.message || error.toString() || '').toLowerCase();

    // 1. Errores de caché o esquema (el error específico de la captura)
    if (msg.includes('schema cache') || msg.includes('could not find the table') || msg.includes('column') || msg.includes('relation')) {
        return 'Error de sincronización con la base de datos. Por favor, recargue la página o informe a soporte.';
    }

    // 2. Errores de clave duplicada / unicidad
    if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
        return 'Ya existe un registro con este mismo código o identificador. Utilice uno diferente.';
    }

    // 3. Errores de restricciones NOT NULL
    if (msg.includes('violates not-null') || msg.includes('null value in column')) {
        return 'Faltan datos obligatorios por completar. Revise los campos vacíos del formulario.';
    }

    // 4. Errores de llave foránea (intentar eliminar algo que está en uso, o insertar un ID que no existe)
    if (msg.includes('foreign key constraint') || msg.includes('violates foreign key')) {
        return 'No se puede realizar esta acción porque este registro está vinculado o siendo usado por otra parte del sistema.';
    }

    // 5. Errores de Autenticación / Sesión
    if (msg.includes('jwt expired') || msg.includes('invalid claim')) {
        return 'Su sesión de usuario ha expirado por inactividad. Por favor, inicie sesión nuevamente.';
    }
    if (msg.includes('invalid login credentials')) {
        return 'El correo electrónico o la contraseña son incorrectos.';
    }
    if (msg.includes('user not found')) {
        return 'No existe una cuenta registrada con ese correo.';
    }
    if (msg.includes('not valid') && msg.includes('password')) {
        return 'La contraseña es demasiado débil o inválida.';
    }

    // 6. Errores de Red / Fetch (fetch failed, network error)
    if (msg.includes('fetch') || msg.includes('network error') || msg.includes('failed to fetch')) {
        return 'Ocurrió un error de conexión. Verifique su acceso a internet e intente de nuevo.';
    }

    // Si no coincide con ninguno, intentamos mostrar su mensaje propio si es muy corto, 
    // pero si es largo/técnico como postgrest, mostramos uno estándar.
    if (msg.includes('postgrest') || msg.includes('postgres') || msg.includes('sql') || msg.length > 80) {
        return 'Ocurrió un error interno en el servidor. Intente más tarde o comuníquese con soporte.';
    }

    // Retorna el mensaje original si se asume que es algo de la lógica de UI amigable
    return error.message || 'Error inesperado. Contacte a soporte si el problema persiste.';
}

// handleAlertError removed — use `toast(getFriendlyErrorMessage(err), 'error')` instead
