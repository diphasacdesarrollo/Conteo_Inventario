// inventario/static/inventario/js/conteo.js
document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // 1) ZONA / SUBZONA
  // =========================
  const zonaSelect = document.getElementById("zona");
  const subzonaSelect = document.getElementById("subzona");

  if (zonaSelect && subzonaSelect) {
    const urlSubzonas = zonaSelect.dataset.subzonasUrl || "/subzonas/";

    async function loadSubzonas(zonaId, selectedId) {
      subzonaSelect.disabled = true;
      subzonaSelect.innerHTML = '<option value="">Cargando…</option>';
      try {
        const res = await fetch(
          `${urlSubzonas}?zona=${encodeURIComponent(zonaId)}`
        );
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
        subzonaSelect.innerHTML =
          '<option value="">Error al cargar subzonas</option>';
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

    // Exponer por si otro script lo necesita
    window.__conteo_loadSubzonas__ = loadSubzonas;
  }

  // =========================
  // 2) BUSCADOR (incidencias)
  // =========================
  const buscador = document.getElementById("buscador-incidencia");
  const btnUsar = document.getElementById("btn-usar-en-comentario");
  const txtInc = document.getElementById("incidencia_comentario");

  if (buscador) {
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
      boxShadow: "0 4px 12px rgba(0,0,0,.08)",
    });
    document.body.appendChild(lista);

    function posLista() {
      const r = buscador.getBoundingClientRect();
      lista.style.left = r.left + window.scrollX + "px";
      lista.style.top = r.bottom + window.scrollY + "px";
      lista.style.width = r.width + "px";
    }
    function ocultarLista() {
      lista.style.display = "none";
      lista.innerHTML = "";
    }
    function mostrarLista(html) {
      lista.innerHTML = html;
      lista.style.display = "block";
      posLista();
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function setZonaSubzona(zonaId, subzonaId, zonaTexto, subzonaTexto) {
      // Caso ideal: vienen IDs
      if (zonaSelect && subzonaSelect && zonaId) {
        zonaSelect.value = String(zonaId);
        zonaSelect.dispatchEvent(new Event("change"));
        for (let i = 0; i < 12; i++) {
          if (
            [...subzonaSelect.options].some(
              (o) => String(o.value) === String(subzonaId)
            )
          ) {
            subzonaSelect.value = String(subzonaId);
            subzonaSelect.dispatchEvent(new Event("change"));
            break;
          }
          await sleep(150);
        }
        return;
      }

      // Fallback: por texto
      if (zonaSelect && zonaTexto) {
        const optZona = [...zonaSelect.options].find(
          (o) =>
            (o.textContent || "").trim() === String(zonaTexto).trim()
        );
        if (optZona) {
          zonaSelect.value = optZona.value;
          zonaSelect.dispatchEvent(new Event("change"));
          await sleep(250);
        }
      }
      if (subzonaSelect && subzonaTexto) {
        const optSub = [...subzonaSelect.options].find(
          (o) =>
            (o.textContent || "").trim() ===
            String(subzonaTexto).trim()
        );
        if (optSub) {
          subzonaSelect.value = optSub.value;
          subzonaSelect.dispatchEvent(new Event("change"));
        }
      }
    }

    function agregarComentario(producto, lote, zona, subzona) {
      if (!txtInc) return;
      const linea =
        `[Incidencia] Producto: ${producto} | Lote: ${lote || "-"} | ` +
        `Zona: ${zona || "-"} | Subzona: ${subzona || "-"} — `;
      txtInc.value =
        (txtInc.value ? txtInc.value + "\n" : "") + linea;
      txtInc.focus();
      txtInc.setSelectionRange(
        txtInc.value.length,
        txtInc.value.length
      );
    }

    function scrollToLote(lote) {
      try {
        const fila =
          document.querySelector(
            `[data-lote="${CSS.escape(lote)}"]`
          ) ||
          Array.from(document.querySelectorAll("table tr")).find(
            (tr) => (tr.textContent || "").includes(lote)
          );
        if (fila)
          fila.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      } catch {
        // no-op
      }
    }

    function parseResultados(data) {
      if (Array.isArray(data)) {
        return data.map((n) => ({
          producto_nombre: n,
          lote_numero: "",
          zona_id: "",
          zona_nombre: "",
          subzona_id: "",
          subzona_nombre: "",
        }));
      }
      if (data && Array.isArray(data.resultados))
        return data.resultados;
      return [];
    }

    let timer = null;
    buscador.addEventListener("input", () => {
      const q = buscador.value.trim();
      clearTimeout(timer);
      if (q.length < 2) {
        ocultarLista();
        return;
      }

      timer = setTimeout(async () => {
        try {
          const params = new URLSearchParams({
            q,
            zona_id: zonaSelect?.value || "",
            subzona_id: subzonaSelect?.value || "",
          });
          const res = await fetch(
            `/buscar-productos/?${params.toString()}`
          );
          const data = await res.json();
          const items = parseResultados(data);
          if (!items.length) {
            ocultarLista();
            return;
          }

          const html = items
            .map(
              (it) => `
            <li class="item" style="padding:8px 10px; cursor:pointer"
                data-producto="${(it.producto_nombre || "")
                  .replace(/"/g, "&quot;")}"
                data-lote="${it.lote_numero || ""}"
                data-zona-id="${it.zona_id || ""}"
                data-zona="${(it.zona_nombre || "")
                  .replace(/"/g, "&quot;")}"
                data-subzona-id="${it.subzona_id || ""}"
                data-subzona="${(it.subzona_nombre || "")
                  .replace(/"/g, "&quot;")}">
              <div style="font-weight:600">
                ${it.producto_nombre || "(sin nombre)"} · Lote ${
                  it.lote_numero || "-"
                }
              </div>
              <div style="font-size:12px;color:#6b7280">
                Zona: ${it.zona_nombre || "-"} · Subzona: ${
                it.subzona_nombre || "-"
              }
              </div>
            </li>
          `
            )
            .join("");
          mostrarLista(html);
        } catch {
          ocultarLista();
        }
      }, 180);
    });

    lista.addEventListener("mousedown", async (ev) => {
      const li = ev.target.closest("li.item");
      if (!li) return;

      const producto = li.getAttribute("data-producto");
      const lote = li.getAttribute("data-lote");
      const zonaId = li.getAttribute("data-zona-id");
      const subzonaId = li.getAttribute("data-subzona-id");
      const zonaTxt = li.getAttribute("data-zona");
      const subzonaTxt = li.getAttribute("data-subzona");

      buscador.value = `${producto}${
        lote ? " · Lote " + lote : ""
      }`;

      await setZonaSubzona(zonaId, subzonaId, zonaTxt, subzonaTxt);
      agregarComentario(producto, lote, zonaTxt, subzonaTxt);
      if (lote) scrollToLote(lote);
      ocultarLista();
    });

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
      if (e.target !== buscador && !lista.contains(e.target))
        ocultarLista();
    });
    window.addEventListener("resize", posLista, { passive: true });
    window.addEventListener("scroll", posLista, true);
  }

  // =========================
  // 3) RESUMEN INVENTARIO + MODAL EXPORT
  // =========================
  (function initResumenInventario() {
    const tbodyDetalle = document.getElementById("tbody");
    const tbodyProdGen = document.getElementById("tbodyProductoGeneral");
    const cardDetalle = document.getElementById("cardDetalle");
    const cardProdGen = document.getElementById("cardProductoGeneral");

    const loader = document.getElementById("loader");
    const infoLabel = document.getElementById("lblInfo");
    const pageInfo = document.getElementById("pageInfo");
    const btnPrev = document.getElementById("prevBtn");
    const btnNext = document.getElementById("nextBtn");
    const btnRefresh = document.getElementById("btnRefrescar");
    const pageSizeInp = document.getElementById("page_size");
    const btnExport = document.getElementById("btnExportar");

    const toggleModo = document.getElementById("toggleModo");
    const btnProductoGeneral = document.getElementById("btnProductoGeneral");
    const modoHelp = document.getElementById("modoHelp");
    const inputModo = document.getElementById("modo");

    const fieldZona = document.getElementById("fieldZona");
    const fieldSubzona = document.getElementById("fieldSubzona");
    const fieldProducto = document.getElementById("fieldProducto");
    const fieldLote = document.getElementById("fieldLote");
    const inputProducto = document.getElementById("producto_codigo");
    const inputLote = document.getElementById("lote_numero");
    const estadoFiltro = document.getElementById("estado_filtro");

    // Modal export
    const modalExport = document.getElementById("modalExportExcel");
    const btnExportVistaActual = document.getElementById(
      "btnExportVistaActual"
    );
    const btnExportCompleto = document.getElementById("btnExportCompleto");
    const btnExportCancelar = document.getElementById("btnExportCancelar");

    if (
      !tbodyDetalle ||
      !loader ||
      !infoLabel ||
      !pageInfo ||
      !btnPrev ||
      !btnNext ||
      !pageSizeInp
    ) {
      return; // no estamos en esta página
    }

    const rootResumen = document.getElementById("resumen-root");
    const URL_RESUMEN = rootResumen
      ? rootResumen.dataset.urlResumen
      : "/resumen/datos/";
    const URL_EXPORT = rootResumen
      ? rootResumen.dataset.urlExport
      : "/resumen/exportar/";

    const urlProductos = inputProducto
      ? inputProducto.dataset.urlProductos
      : null;
    const urlLotes = inputProducto ? inputProducto.dataset.urlLotes : null;

    let filterMode = inputModo ? inputModo.value || "ubicacion" : "ubicacion"; // ubicacion | producto
    let viewMode = "detalle"; // detalle | producto_general
    let currentPage = 1;

    function fmt(n) {
      if (n === null || n === undefined) return "";
      if (typeof n === "number") return n.toLocaleString("es-PE");
      const parsed = Number(n);
      if (!isNaN(parsed)) return parsed.toLocaleString("es-PE");
      return n;
    }

    function showLoader(show) {
      loader.classList.toggle("show", !!show);
    }

    function optNombreZona() {
      if (!zonaSelect) return "";
      const opt = zonaSelect.options[zonaSelect.selectedIndex];
      return opt
        ? opt.dataset.nombre || opt.textContent.trim()
        : "";
    }

    function optNombreSubzona() {
      if (!subzonaSelect) return "";
      const opt =
        subzonaSelect.options[subzonaSelect.selectedIndex];
      return opt ? opt.textContent.trim() : "";
    }

    function getZonaParam() {
      if (filterMode === "ubicacion") return optNombreZona();
      return (inputProducto ? inputProducto.value : "").trim();
    }

    function getSubzonaParam() {
      if (filterMode === "ubicacion") return optNombreSubzona();
      return (inputLote ? inputLote.value : "").trim();
    }

    function syncUI() {
      if (cardDetalle)
        cardDetalle.style.display =
          viewMode === "detalle" ? "" : "none";
      if (cardProdGen)
        cardProdGen.style.display =
          viewMode === "producto_general" ? "" : "none";

      if (viewMode === "detalle") {
        if (filterMode === "ubicacion") {
          if (fieldZona) fieldZona.style.display = "";
          if (fieldSubzona) fieldSubzona.style.display = "";
          if (fieldProducto) fieldProducto.style.display = "none";
          if (fieldLote) fieldLote.style.display = "none";
          if (modoHelp) modoHelp.textContent = "Usando Zona / Subzona";
          if (toggleModo) toggleModo.textContent = "Filtrar por producto";
        } else {
          if (fieldZona) fieldZona.style.display = "none";
          if (fieldSubzona) fieldSubzona.style.display = "none";
          if (fieldProducto) fieldProducto.style.display = "";
          if (fieldLote) fieldLote.style.display = "";
          if (modoHelp)
            modoHelp.textContent = "Usando Código de producto / Lote";
          if (toggleModo) toggleModo.textContent = "Filtrar por ubicación";
        }
      } else {
        if (fieldZona) fieldZona.style.display = "none";
        if (fieldSubzona) fieldSubzona.style.display = "none";
        if (fieldProducto) fieldProducto.style.display = "";
        if (fieldLote) fieldLote.style.display = "";
        if (modoHelp)
          modoHelp.textContent = "Resumen global por Producto / Lote";
        if (toggleModo) toggleModo.textContent = "Volver a detalle";
      }

      if (inputModo) inputModo.value = filterMode;

      if (btnPrev)
        btnPrev.style.display = viewMode === "detalle" ? "" : "none";
      if (btnNext)
        btnNext.style.display = viewMode === "detalle" ? "" : "none";
      if (pageInfo) {
        pageInfo.textContent =
          viewMode === "detalle"
            ? `Página ${currentPage}`
            : "Vista Producto General";
      }
    }

    // --- combos producto/lote ---
    async function loadProductos(selectedCodigo) {
      if (!inputProducto || !urlProductos) return;
      inputProducto.disabled = true;
      inputProducto.innerHTML =
        '<option value="">Cargando productos…</option>';
      try {
        const res = await fetch(urlProductos);
        const data = await res.json();
        const items = data.productos || [];
        if (!items.length) {
          inputProducto.innerHTML =
            '<option value="">(sin productos)</option>';
          return;
        }
        inputProducto.innerHTML =
          '<option value="">— Selecciona producto —</option>';
        items.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.codigo;
          opt.textContent = p.nombre || "";
          if (
            selectedCodigo &&
            String(selectedCodigo) === String(p.codigo)
          ) {
            opt.selected = true;
          }
          inputProducto.appendChild(opt);
        });
      } catch {
        inputProducto.innerHTML =
          '<option value="">Error al cargar</option>';
      } finally {
        inputProducto.disabled = false;
      }
    }

    async function loadLotes(codigo, selectedLote) {
      if (!inputLote || !urlLotes) return;
      inputLote.disabled = true;
      inputLote.innerHTML =
        '<option value="">Cargando lotes…</option>';
      try {
        const params = new URLSearchParams();
        if (codigo) params.set("codigo", codigo);
        const res = await fetch(`${urlLotes}?${params.toString()}`);
        const data = await res.json();
        const items = data.lotes || [];
        inputLote.innerHTML =
          '<option value="">— Todos los lotes —</option>';
        items.forEach((l) => {
          const opt = document.createElement("option");
          opt.value = l.lote;
          opt.textContent = l.lote;
          if (
            selectedLote &&
            String(selectedLote) === String(l.lote)
          ) {
            opt.selected = true;
          }
          inputLote.appendChild(opt);
        });
      } catch {
        inputLote.innerHTML =
          '<option value="">Error al cargar lotes</option>';
      } finally {
        inputLote.disabled = false;
      }
    }

    // --- DETALLE ---
    async function loadDetalle(page) {
      const zonaParam = getZonaParam();
      const subParam = getSubzonaParam();
      const pageSize = parseInt(pageSizeInp.value || "200", 10);
      const estado = estadoFiltro ? estadoFiltro.value || "" : "";

      showLoader(true);
      tbodyDetalle.innerHTML =
        '<tr><td colspan="10" class="empty">Cargando…</td></tr>';

      try {
        const qs = new URLSearchParams({
          modo: filterMode,
          zona: zonaParam,
          subzona: subParam,
          page,
          page_size: pageSize,
        });
        if (estado) qs.set("estado", estado);

        const res = await fetch(`${URL_RESUMEN}?${qs.toString()}`);
        const json = await res.json();
        const items = json.data || [];

        tbodyDetalle.innerHTML = "";
        if (!items.length) {
          tbodyDetalle.innerHTML =
            '<tr><td colspan="10" class="empty">Sin datos para el filtro seleccionado.</td></tr>';
        } else {
          for (const row of items) {
            const tr = document.createElement("tr");

            const estadoTxt = row.estado || "";
            const estadoLower = estadoTxt.toLowerCase();
            let estadoClass = "";
            if (estadoLower.startsWith("ok")) estadoClass = "status-ok";
            else if (estadoLower.startsWith("pendiente"))
              estadoClass = "status-pend";

            const g1Tag = row.g1_n ? `C${row.g1_n}` : "";
            const g2Tag = row.g2_n ? `C${row.g2_n}` : "";
            const g3Tag = row.g3_n ? `C${row.g3_n}` : "";
            const g4Tag = row.g4_n ? `C${row.g4_n}` : "";

            tr.innerHTML = `
              <td>${row.ubicacion || ""}</td>
              <td>${row.producto || ""}</td>
              <td>${row.lote || ""}</td>
              <td class="right">${fmt(row.sistema)}</td>
              <td class="right">
                ${fmt(row.g1)}
                ${g1Tag ? `<span class="g-conteo-tag">${g1Tag}</span>` : ""}
              </td>
              <td class="right">
                ${fmt(row.g2)}
                ${g2Tag ? `<span class="g-conteo-tag">${g2Tag}</span>` : ""}
              </td>
              <td class="right">
                ${fmt(row.g3)}
                ${g3Tag ? `<span class="g-conteo-tag">${g3Tag}</span>` : ""}
              </td>
              <td class="right">
                ${fmt(row.g4)}
                ${g4Tag ? `<span class="g-conteo-tag">${g4Tag}</span>` : ""}
              </td>
              <td class="right">${fmt(row.delta)}</td>
              <td class="status ${estadoClass}">${estadoTxt}</td>
            `;
            tbodyDetalle.appendChild(tr);
          }
        }

        currentPage = page;
        pageInfo.textContent = `Página ${currentPage}`;

        if (filterMode === "producto") {
          infoLabel.textContent = `Producto: ${json.zona || "—"} • Lote: ${
            json.subzona || "—"
          } • Filas: ${items.length}`;
        } else {
          infoLabel.textContent = `Zona: ${json.zona || "—"} • Subzona: ${
            json.subzona || "—"
          } • Filas: ${items.length}`;
        }

        btnPrev.disabled = currentPage <= 1;
        btnNext.disabled = items.length < pageSize;
      } catch (e) {
        tbodyDetalle.innerHTML =
          '<tr><td colspan="10" class="empty">Ocurrió un error al cargar los datos.</td></tr>';
      } finally {
        showLoader(false);
      }
    }

    // --- PRODUCTO GENERAL ---
    async function loadProductoGeneral() {
      const codigo = (inputProducto ? inputProducto.value : "").trim();
      const lote = (inputLote ? inputLote.value : "").trim();

      showLoader(true);
      tbodyProdGen.innerHTML =
        '<tr><td colspan="7" class="empty">Cargando…</td></tr>';

      try {
        const qs = new URLSearchParams({
          modo: "producto",
          zona: codigo,
          subzona: lote,
          page: 1,
          page_size: 5000,
        });
        const res = await fetch(`${URL_RESUMEN}?${qs.toString()}`);
        const json = await res.json();
        const items = json.data || [];

        const agg = new Map();
        for (const row of items) {
          const prod = row.producto || "";
          const loteNum = row.lote || "";
          const key = `${prod}||${loteNum}`;
          if (!agg.has(key)) {
            agg.set(key, {
              producto: prod,
              lote: loteNum,
              sistema: 0,
              g1: 0,
              g2: 0,
              g3: 0,
              g4: 0,
            });
          }
          const acc = agg.get(key);
          const addNum = (field) => {
            const v = row[field];
            if (v !== null && v !== undefined && v !== "") {
              const num = Number(v);
              if (!isNaN(num)) acc[field] += num;
            }
          };
          addNum("sistema");
          addNum("g1");
          addNum("g2");
          addNum("g3");
          addNum("g4");
        }

        const rowsAgg = Array.from(agg.values());
        tbodyProdGen.innerHTML = "";

        if (!rowsAgg.length) {
          tbodyProdGen.innerHTML =
            '<tr><td colspan="7" class="empty">Sin datos para el filtro seleccionado.</td></tr>';
        } else {
          rowsAgg.forEach((r) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${r.producto}</td>
              <td>${r.lote}</td>
              <td class="right">${fmt(r.sistema)}</td>
              <td class="right">${fmt(r.g1)}</td>
              <td class="right">${fmt(r.g2)}</td>
              <td class="right">${fmt(r.g3)}</td>
              <td class="right">${fmt(r.g4)}</td>
            `;
            tbodyProdGen.appendChild(tr);
          });
        }

        infoLabel.textContent = `Producto General · Producto: ${
          json.zona || "—"
        } · Lote: ${json.subzona || "—"} · Filas: ${rowsAgg.length}`;
        pageInfo.textContent = "Vista Producto General";
        btnPrev.disabled = true;
        btnNext.disabled = true;
      } catch {
        tbodyProdGen.innerHTML =
          '<tr><td colspan="7" class="empty">Ocurrió un error al cargar los datos.</td></tr>';
      } finally {
        showLoader(false);
      }
    }

    // --- eventos filtros/paginación ---
    if (zonaSelect && subzonaSelect) {
      zonaSelect.addEventListener("change", () => {
        if (viewMode !== "detalle" || filterMode !== "ubicacion") return;
        currentPage = 1;
        loadDetalle(currentPage);
      });
      subzonaSelect.addEventListener("change", () => {
        if (viewMode !== "detalle" || filterMode !== "ubicacion") return;
        currentPage = 1;
        loadDetalle(currentPage);
      });
    }

    if (inputProducto) {
      inputProducto.addEventListener("change", () => {
        const codigo = inputProducto.value || "";
        loadLotes(codigo, null);
        if (viewMode === "detalle" && filterMode === "producto") {
          currentPage = 1;
          loadDetalle(currentPage);
        } else if (viewMode === "producto_general") {
          loadProductoGeneral();
        }
      });
    }

    if (inputLote) {
      inputLote.addEventListener("change", () => {
        if (viewMode === "detalle" && filterMode === "producto") {
          currentPage = 1;
          loadDetalle(currentPage);
        } else if (viewMode === "producto_general") {
          loadProductoGeneral();
        }
      });
    }

    if (estadoFiltro) {
      estadoFiltro.addEventListener("change", () => {
        if (viewMode !== "detalle") return;
        currentPage = 1;
        loadDetalle(currentPage);
      });
    }

    pageSizeInp.addEventListener("change", () => {
      if (viewMode !== "detalle") return;
      currentPage = 1;
      loadDetalle(currentPage);
    });

    btnPrev.addEventListener("click", () => {
      if (viewMode !== "detalle") return;
      if (currentPage <= 1) return;
      currentPage -= 1;
      loadDetalle(currentPage);
    });

    btnNext.addEventListener("click", () => {
      if (viewMode !== "detalle") return;
      currentPage += 1;
      loadDetalle(currentPage);
    });

    if (btnRefresh) {
      btnRefresh.addEventListener("click", () => {
        if (viewMode === "detalle") loadDetalle(currentPage);
        else loadProductoGeneral();
      });
    }

    if (toggleModo) {
      toggleModo.addEventListener("click", () => {
        if (viewMode === "producto_general") {
          viewMode = "detalle";
          filterMode = "ubicacion";
          currentPage = 1;
          syncUI();
          loadDetalle(currentPage);
        } else {
          filterMode =
            filterMode === "ubicacion" ? "producto" : "ubicacion";
          viewMode = "detalle";
          currentPage = 1;
          syncUI();
          loadDetalle(currentPage);
        }
      });
    }

    if (btnProductoGeneral) {
      btnProductoGeneral.addEventListener("click", () => {
        filterMode = "producto";
        viewMode = "producto_general";
        syncUI();
        if (inputProducto && urlProductos && !inputProducto.options.length) {
          loadProductos(null).then(() => loadProductoGeneral());
        } else {
          loadProductoGeneral();
        }
      });
    }

    // --- Exportar Excel con modal ---
    function doExport(alcance) {
      const vista =
        viewMode === "producto_general" ? "producto_general" : "detalle";
      const qs = new URLSearchParams();
      qs.set("modo", filterMode);
      qs.set("vista", vista);
      qs.set("alcance", alcance);

      if (alcance === "actual") {
        const zona = getZonaParam();
        const subzona = getSubzonaParam();
        if (zona) qs.set("zona", zona);
        if (subzona) qs.set("subzona", subzona);
        if (vista === "detalle" && estadoFiltro) {
          const estado = estadoFiltro.value || "";
          if (estado) qs.set("estado", estado);
        }
      }

      window.open(`${URL_EXPORT}?${qs.toString()}`, "_blank");
    }

    function openExportModal() {
      if (!modalExport) {
        doExport("actual");
        return;
      }
      modalExport.style.display = "flex";
    }

    function closeExportModal() {
      if (modalExport) modalExport.style.display = "none";
    }

    if (btnExport) {
      btnExport.addEventListener("click", () => {
        openExportModal();
      });
    }
    if (btnExportVistaActual) {
      btnExportVistaActual.addEventListener("click", () => {
        doExport("actual");
        closeExportModal();
      });
    }
    if (btnExportCompleto) {
      btnExportCompleto.addEventListener("click", () => {
        doExport("completo");
        closeExportModal();
      });
    }
    if (btnExportCancelar) {
      btnExportCancelar.addEventListener("click", () => {
        closeExportModal();
      });
    }
    if (modalExport) {
      modalExport.addEventListener("click", (e) => {
        if (e.target === modalExport) closeExportModal();
      });
    }

    // Inicial
    syncUI();
    if (inputProducto && urlProductos) {
      loadProductos(null);
    }
    loadDetalle(1);
  })();

  // =========================
  // 4) MODAL DE COMENTARIOS
  // =========================
  const modalComentarios = document.getElementById("modalComentarios");
  const btnComentarios = document.getElementById("btnComentarios");
  const btnCerrarModal = document.getElementById("cerrarModalComentarios");

  if (modalComentarios && btnComentarios) {
    // Abrir modal y cargar datos
    btnComentarios.addEventListener("click", () => {
      const root = document.getElementById("resumen-root");
      const url =
        (root && root.dataset.urlComentarios) ||
        "/resumen/comentarios/";

      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          const tbody = document.getElementById("tbodyComentarios");
          if (!tbody) return;

          tbody.innerHTML = "";
          (data.comentarios || []).forEach((c) => {
            tbody.innerHTML += `
              <tr>
                <td style="padding:6px; border:1px solid #ccc;">${c.id}</td>
                <td style="padding:6px; border:1px solid #ccc;">${c.grupo}</td>
                <td style="padding:6px; border:1px solid #ccc;">${c.numero_conteo}</td>
                <td style="padding:6px; border:1px solid #ccc;">${c.ubicacion_real}</td>
                <td style="padding:6px; border:1px solid #ccc;">${c.comentario}</td>
                <td style="padding:6px; border:1px solid #ccc;">${c.fecha}</td>
              </tr>`;
          });

          // Mostrar modal
          modalComentarios.style.display = "flex";
        })
        .catch((err) => {
          console.error("Error cargando comentarios:", err);
          modalComentarios.style.display = "flex"; // igual abrimos para que puedas cerrar
        });
    });

    // Botón "Cerrar"
    if (btnCerrarModal) {
      btnCerrarModal.addEventListener("click", () => {
        modalComentarios.style.display = "none";
      });
    }

    // Cerrar haciendo clic en el fondo gris
    modalComentarios.addEventListener("click", (e) => {
      if (e.target === modalComentarios) {
        modalComentarios.style.display = "none";
      }
    });

    // Cerrar con la tecla ESC
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        modalComentarios.style.display === "flex"
      ) {
        modalComentarios.style.display = "none";
      }
    });
  }
});