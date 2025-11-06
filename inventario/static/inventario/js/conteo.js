// inventario/static/inventario/js/conteo.js
document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // 1) ZONA / SUBZONA
  // =========================
  const zonaSelect = document.getElementById("zona");
  const subzonaSelect = document.getElementById("subzona");

  if (zonaSelect && subzonaSelect) {
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
      } catch {
        subzonaSelect.innerHTML = '<option value="">Error al cargar subzonas</option>';
      } finally {
        subzonaSelect.disabled = false;
      }
    }

    zonaSelect.addEventListener("change", () => {
      const zonaId = zonaSelect.value;
      subzonaSelect.innerHTML = '<option value="">— Selecciona —</option>';
      if (zonaId) loadSubzonas(zonaId, null);
    });

    if (zonaSelect.value) {
      const selected = subzonaSelect.dataset.selected || null;
      loadSubzonas(zonaSelect.value, selected);
    }

    // Exponer para uso interno
    window.__conteo_loadSubzonas__ = loadSubzonas;
  }

  // =========================
  // 2) BUSCADOR INTEGRAL (INCIDENCIAS)
  // =========================
  const buscador = document.getElementById("buscador-incidencia");
  const btnUsar = document.getElementById("btn-usar-en-comentario");
  const txtInc = document.getElementById("incidencia_comentario");
  if (!buscador) return;

  const lista = document.createElement("ul");
  lista.id = "sugerencias-incidencia";
  Object.assign(lista.style, {
    position: "absolute",
    zIndex: 9999,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    marginTop: "4px",
    listStyle: "none",
    padding: "6px 0",
    width: "320px",
    maxHeight: "280px",
    overflow: "auto",
    display: "none",
    boxShadow: "0 4px 12px rgba(0,0,0,.08)"
  });
  document.body.appendChild(lista);

  function posLista() {
    const r = buscador.getBoundingClientRect();
    lista.style.left = r.left + window.scrollX + "px";
    lista.style.top = r.bottom + window.scrollY + "px";
    lista.style.width = r.width + "px";
  }
  function ocultarLista() { lista.style.display = "none"; lista.innerHTML = ""; }
  function mostrarLista(html) { lista.innerHTML = html; lista.style.display = "block"; posLista(); }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function setZonaSubzona(zonaId, subzonaId, zonaTexto, subzonaTexto) {
    if (zonaSelect && subzonaSelect && zonaId) {
      zonaSelect.value = String(zonaId);
      zonaSelect.dispatchEvent(new Event("change"));
      // esperar a que carguen subzonas
      for (let i = 0; i < 12; i++) {
        if ([...subzonaSelect.options].some(o => String(o.value) === String(subzonaId))) {
          subzonaSelect.value = String(subzonaId);
          subzonaSelect.dispatchEvent(new Event("change"));
          break;
        }
        await sleep(150);
      }
      return;
    }

    // Fallback por texto (si no vinieron IDs)
    if (zonaSelect && zonaTexto) {
      const optZona = [...zonaSelect.options].find(o => (o.textContent || "").trim() === String(zonaTexto).trim());
      if (optZona) {
        zonaSelect.value = optZona.value;
        zonaSelect.dispatchEvent(new Event("change"));
        await sleep(250);
      }
    }
    if (subzonaSelect && subzonaTexto) {
      const optSub = [...subzonaSelect.options].find(o => (o.textContent || "").trim() === String(subzonaTexto).trim());
      if (optSub) {
        subzonaSelect.value = optSub.value;
        subzonaSelect.dispatchEvent(new Event("change"));
      }
    }
  }

  function agregarComentario(producto, lote, zona, subzona) {
    if (!txtInc) return;
    const linea = `[Incidencia] Producto: ${producto} | Lote: ${lote} | Zona: ${zona || "-"} | Subzona: ${subzona || "-"} — `;
    txtInc.value = (txtInc.value ? txtInc.value + "\n" : "") + linea;
    txtInc.focus();
    txtInc.setSelectionRange(txtInc.value.length, txtInc.value.length);
  }

  function scrollToLote(lote) {
    try {
      const fila =
        document.querySelector(`[data-lote="${CSS.escape(lote)}"]`) ||
        Array.from(document.querySelectorAll("table tr"))
          .find(tr => (tr.textContent || "").includes(lote));
      if (fila) fila.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {}
  }

  function parseResultados(data) {
    if (Array.isArray(data)) {
      return data.map(n => ({
        producto_nombre: n,
        lote_numero: "",
        zona_id: "", zona_nombre: "",
        subzona_id: "", subzona_nombre: ""
      }));
    }
    if (data && Array.isArray(data.resultados)) return data.resultados;
    return [];
  }

  // Debounce + envío de filtros
  let timer = null;
  buscador.addEventListener("input", () => {
    const q = buscador.value.trim();
    clearTimeout(timer);
    if (q.length < 2) { ocultarLista(); return; }

    timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q,
          zona_id: zonaSelect?.value || "",
          subzona_id: subzonaSelect?.value || ""
        });
        const res = await fetch(`/buscar-productos/?${params.toString()}`);
        const data = await res.json();
        const items = parseResultados(data);
        if (!items.length) { ocultarLista(); return; }

        const html = items.map(it => `
          <li class="item" style="padding:8px 10px; cursor:pointer"
              data-producto="${(it.producto_nombre || "").replace(/"/g,'&quot;')}"
              data-lote="${it.lote_numero || ""}"
              data-zona-id="${it.zona_id || ""}"
              data-zona="${(it.zona_nombre || "").replace(/"/g,'&quot;')}"
              data-subzona-id="${it.subzona_id || ""}"
              data-subzona="${(it.subzona_nombre || "").replace(/"/g,'&quot;')}">
            <div style="font-weight:600">${it.producto_nombre || "(sin nombre)"} · Lote ${it.lote_numero || "-"}</div>
            <div style="font-size:12px;color:#6b7280">
              Zona: ${it.zona_nombre || "-"} · Subzona: ${it.subzona_nombre || "-"}
            </div>
          </li>
        `).join("");
        mostrarLista(html);
      } catch {
        ocultarLista();
      }
    }, 180);
  });

  // Selección de sugerencia
  lista.addEventListener("mousedown", async (ev) => {
    const li = ev.target.closest("li.item");
    if (!li) return;

    const producto = li.getAttribute("data-producto");
    const lote = li.getAttribute("data-lote");
    const zonaId = li.getAttribute("data-zona-id");
    const subzonaId = li.getAttribute("data-subzona-id");
    const zonaTxt = li.getAttribute("data-zona");
    const subzonaTxt = li.getAttribute("data-subzona");

    buscador.value = `${producto}${lote ? " · Lote " + lote : ""}`;

    await setZonaSubzona(zonaId, subzonaId, zonaTxt, subzonaTxt);
    agregarComentario(producto, lote, zonaTxt, subzonaTxt);
    if (lote) scrollToLote(lote);
    ocultarLista();
  });

  // Botón “Usar en comentario”
  if (btnUsar) {
    btnUsar.addEventListener("click", () => {
      const q = (buscador.value || "").trim();
      if (!q || !txtInc) return;
      const m = q.match(/lote\s+([^\s]+)$/i);
      const lote = m ? m[1] : "";
      agregarComentario(q.replace(/\s*·\s*/g, " "), lote, "", "");
      ocultarLista();
    });
  }

  document.addEventListener("click", (e) => {
    if (e.target !== buscador && !lista.contains(e.target)) ocultarLista();
  });
  window.addEventListener("resize", posLista, { passive: true });
  window.addEventListener("scroll", posLista, true);
});