// inventario/static/inventario/js/conteo.js
document.addEventListener("DOMContentLoaded", () => {
  const zonaSelect = document.getElementById("zona");
  const subzonaSelect = document.getElementById("subzona");
  if (!zonaSelect || !subzonaSelect) return;

  const url = zonaSelect.dataset.subzonasUrl || "/subzonas/";

  async function loadSubzonas(zonaId, selectedId) {
    subzonaSelect.disabled = true;
    subzonaSelect.innerHTML = '<option value="">Cargando…</option>';
    try {
      const res = await fetch(`${url}?zona=${encodeURIComponent(zonaId)}`);
      const data = await res.json();
      subzonaSelect.innerHTML = '<option value="">— Selecciona —</option>';
      (data.subzonas || []).forEach((sub) => {
        const opt = document.createElement("option");
        opt.value = sub.id;
        opt.textContent = sub.nombre;
        if (selectedId != null && String(selectedId) === String(sub.id)) {
          opt.selected = true;
        }
        subzonaSelect.appendChild(opt);
      });
    } catch (e) {
      subzonaSelect.innerHTML = '<option value="">Error al cargar subzonas</option>';
    } finally {
      subzonaSelect.disabled = false;
    }
  }

  // Al cambiar la zona, recargar subzonas
  zonaSelect.addEventListener("change", () => {
    const zonaId = zonaSelect.value;
    subzonaSelect.innerHTML = '<option value="">— Selecciona —</option>';
    if (zonaId) loadSubzonas(zonaId, null);
  });

  // Al entrar a la página, si ya hay zona seleccionada (por sesión/GET), cargar sus subzonas
  if (zonaSelect.value) {
    const selected = subzonaSelect.dataset.selected || null;
    loadSubzonas(zonaSelect.value, selected);
  }
});