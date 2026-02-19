import uuid
import hashlib
import tkinter as tk
from tkinter import ttk, messagebox
import datetime

SECRET_KEY = "secretcode"  # Usa la misma clave que en el programa principal

def get_mac_address():
    """Obtiene la dirección MAC del equipo actual."""
    mac = uuid.getnode()
    mac_str = ':'.join(("%012X" % mac)[i:i+2] for i in range(0, 12, 2))
    return mac_str

def generate_license(mac, expiration_date):
    """Genera un código de licencia en base a la MAC y fecha de expiración."""
    data = f"{mac}|{expiration_date}|{SECRET_KEY}"
    hash_object = hashlib.sha256(data.encode("utf-8"))
    return hash_object.hexdigest().upper()

def copiar_al_portapapeles():
    """Copia solo la licencia generada al portapapeles."""
    licencia = result_licencia.get()
    if licencia:
        root.clipboard_clear()
        root.clipboard_append(licencia)
        root.update()
        messagebox.showinfo("Copiado", "🔑 La licencia ha sido copiada al portapapeles.")

def generar_y_mostrar():
    """Genera la licencia y la muestra en pantalla."""
    try:
        mac = entry_mac.get().strip().upper()
        dias = int(entry_dias.get())

        if not mac or len(mac) < 10:
            messagebox.showerror("Error", "⚠️ Dirección MAC inválida.")
            return
        if dias <= 0:
            messagebox.showerror("Error", "⚠️ La cantidad de días debe ser mayor a 0.")
            return

        expiration_date = (datetime.date.today() + datetime.timedelta(days=dias)).strftime("%Y-%m-%d")
        license_code = generate_license(mac, expiration_date)

        # Mostrar resultados en los campos de salida
        result_fecha.config(state=tk.NORMAL)
        result_fecha.delete(0, tk.END)
        result_fecha.insert(0, expiration_date)
        result_fecha.config(state=tk.DISABLED)

        result_licencia.config(state=tk.NORMAL)
        result_licencia.delete(0, tk.END)
        result_licencia.insert(0, license_code)
        result_licencia.config(state=tk.DISABLED)

        # Habilitar botón de copiar
        btn_copiar.config(state=tk.NORMAL)
    except ValueError:
        messagebox.showerror("Error", "⚠️ Ingrese un número válido de días.")

# ======================== Interfaz Gráfica ========================
root = tk.Tk()
root.title("🔐 Generador de Licencias Nipponflex")
root.geometry("500x300")
root.resizable(False, False)
root.configure(bg="#f0f0f0")

style = ttk.Style()
style.configure("TButton", font=("Arial", 10, "bold"), padding=6)

frame = ttk.Frame(root, padding=15)
frame.pack(fill="both", expand=True)

# ======= Widgets ========
ttk.Label(frame, text="🖥️ Dirección MAC:", font=("Arial", 11, "bold")).grid(row=0, column=0, sticky="w", pady=5)
entry_mac = ttk.Entry(frame, width=30, font=("Arial", 11))
entry_mac.insert(0, get_mac_address())  # Autocompletar con la MAC del equipo
entry_mac.grid(row=0, column=1, pady=5)

ttk.Label(frame, text="📅 Días de Validez:", font=("Arial", 11, "bold")).grid(row=1, column=0, sticky="w", pady=5)
entry_dias = ttk.Entry(frame, width=10, font=("Arial", 11))
entry_dias.insert(0, "30")
entry_dias.grid(row=1, column=1, pady=5, sticky="w")

btn_generar = ttk.Button(frame, text="🎯 Generar Licencia", command=generar_y_mostrar)
btn_generar.grid(row=2, column=0, columnspan=2, pady=10)

ttk.Label(frame, text="📅 Expira el:", font=("Arial", 11, "bold")).grid(row=3, column=0, sticky="w", pady=5)
result_fecha = ttk.Entry(frame, width=20, font=("Arial", 11), state=tk.DISABLED)
result_fecha.grid(row=3, column=1, pady=5, sticky="w")

ttk.Label(frame, text="🔑 Licencia:", font=("Arial", 11, "bold")).grid(row=4, column=0, sticky="w", pady=5)
result_licencia = ttk.Entry(frame, width=40, font=("Arial", 11), state=tk.DISABLED)
result_licencia.grid(row=4, column=1, pady=5, sticky="w")

# Botón para copiar solo la licencia
btn_copiar = ttk.Button(frame, text="📋 Copiar Licencia", command=copiar_al_portapapeles, state=tk.DISABLED)
btn_copiar.grid(row=5, column=0, columnspan=2, pady=5)

# Botón para cerrar
btn_cerrar = ttk.Button(frame, text="❌ Cerrar", command=root.destroy)
btn_cerrar.grid(row=6, column=0, columnspan=2, pady=5)

root.mainloop()
