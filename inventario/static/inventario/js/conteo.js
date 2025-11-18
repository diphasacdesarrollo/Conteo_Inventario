// inventario/static/inventario/js/conteo.js
document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // 1) ZONA / SUBZONA
  // =========================
  const zonaSelect = document.getElementById("zona");
  const subzonaSelect = document.getElementById("subzona");

  if (zonaSelect && subzonaSelect) {
    const urlSubzonas =
      zonaSelect.dataset.subzonasUrl || "/subzonas/";

    async function loadSubzonas(zonaId, selectedId) {
      subzonaSelect.disabled = true;
      subzonaSelect.innerHTML =
        '<option value="">Cargando…</option>';
      try {
        const res = await fetch(
          `${urlSubzonas}?zona=${encodeURIComponent(zonaId)}`
        );
        const data = await res.json();
        subzonaSelect.innerHTML =
          '<option value="">— Selecciona —</option>';
        (data.subzonas || []).forEach((sub) => {
          const opt = document.createElement("option");
          opt.value = sub.id;
          opt.textContent = sub.nombre;
          if (
            selectedId != null &&
            String(selectedId) === String(sub.id)
          ) {
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
      subzonaSelect.innerHTML =
        '<option value="">— Selecciona —</option>';
      if (zonaId) loadSubzonas(zonaId, null);
    });

    if (zonaSelect.value) {
      const selected = subzonaSelect.dataset.selected || null;
      loadSubzonas(zonaSelect.value, selected);
    }

    // Exponer para uso desde otros scripts si se necesita
    window.__conteo_loadSubzonas__ = loadSubzonas;
  }

  // =========================
  // 2) BUSCADOR INTEGRAL (INCIDENCIAS)
  // =========================
  const buscador = document.getElementById("buscador-incidencia");
  const btnUsar = document.getElementById("btn-usar-en-comentario");
  const txtInc = document.getElementById("incidencia_comentario");

  // Solo inicializamos el buscador si existe en esta página
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
      boxShadow: "0 4px 12px rgba(0,0,0,.08)"
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

    async function setZonaSubzona(
      zonaId,
      subzonaId,
      zonaTexto,
      subzonaTexto
    ) {
      if (zonaSelect && subzonaSelect && zonaId) {
        zonaSelect.value = String(zonaId);
        zonaSelect.dispatchEvent(new Event("change"));
        // esperar a que carguen subzonas
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

      // Fallback por texto (si no vinieron IDs)
      if (zonaSelect && zonaTexto) {
        const optZona = [...zonaSelect.options].find(
          (o) =>
            (o.textContent || "").trim() ===
            String(zonaTexto).trim()
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
            block: "center"
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
          subzona_nombre: ""
        }));
      }
      if (data && Array.isArray(data.resultados))
        return data.resultados;
      return [];
    }

    // Debounce + envío de filtros
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
            subzona_id: subzonaSelect?.value || ""
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
                ${it.producto_nombre || "(sin nombre)"} · Lote ${it.lote_numero || "-"
                }
              </div>
              <div style="font-size:12px;color:#6b7280">
                Zona: ${it.zona_nombre || "-"} · Subzona: ${it.subzona_nombre || "-"
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

      buscador.value = `${producto}${lote ? " · Lote " + lote : ""
        }`;

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
      if (e.target !== buscador && !lista.contains(e.target))
        ocultarLista();
    });
    window.addEventListener("resize", posLista, { passive: true });
    window.addEventListener("scroll", posLista, true);
  }

  // =========================
  // 3) RESUMEN INVENTARIO (MODO UBICACIÓN / PRODUCTO)
  // =========================
  (function initResumenInventario() {
    const tbody = document.getElementById("tbody");
    const loader = document.getElementById("loader");
    const infoLabel = document.getElementById("lblInfo");
    const pageInfo = document.getElementById("pageInfo");
    const btnPrev = document.getElementById("prevBtn");
    const btnNext = document.getElementById("nextBtn");
    const btnRefresh = document.getElementById("btnRefrescar");
    const pageSizeInp = document.getElementById("page_size");
    const btnExport = document.getElementById("btnExportar");

    const toggleModo = document.getElementById("toggleModo");
    const modoHelp = document.getElementById("modoHelp");
    const inputModo = document.getElementById("modo");

    const fieldZona = document.getElementById("fieldZona");
    const fieldSubzona = document.getElementById("fieldSubzona");
    const fieldProducto = document.getElementById("fieldProducto");
    const fieldLote = document.getElementById("fieldLote");
    const inputProducto = document.getElementById("producto_codigo");
    const inputLote = document.getElementById("lote_numero");

    // Si no hay tabla de resumen, no hacemos nada (p.ej. en conteo_producto.html)
    if (
      !tbody ||
      !loader ||
      !infoLabel ||
      !pageInfo ||
      !btnPrev ||
      !btnNext ||
      !pageSizeInp
    ) {
      return;
    }

    // Raíz del resumen: URLs para datos y exportar
    const rootResumen = document.getElementById("resumen-root");
    const URL_RESUMEN = rootResumen
      ? rootResumen.dataset.urlResumen
      : "/resumen/datos/";
    const URL_EXPORT = rootResumen
      ? rootResumen.dataset.urlExport
      : "/resumen/exportar/";

    // URLs para combos de producto/lote
    const urlProductos = inputProducto
      ? inputProducto.dataset.urlProductos
      : null;
    const urlLotes = inputProducto
      ? inputProducto.dataset.urlLotes
      : null;

    let currentPage = 1;
    let currentMode = inputModo
      ? inputModo.value || "ubicacion"
      : "ubicacion";

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

    function optNombreSub() {
      if (!subzonaSelect) return "";
      const opt = subzonaSelect.options[subzonaSelect.selectedIndex];
      return opt ? opt.textContent.trim() : "";
    }

    function syncModoUI() {
      if (!toggleModo || !modoHelp) return;
      if (currentMode === "ubicacion") {
        toggleModo.textContent = "Filtrar por ubicación";
        modoHelp.textContent = "Usando Zona / Subzona";
        if (fieldZona) fieldZona.style.display = "";
        if (fieldSubzona) fieldSubzona.style.display = "";
        if (fieldProducto) fieldProducto.style.display = "none";
        if (fieldLote) fieldLote.style.display = "none";
      } else {
        toggleModo.textContent = "Filtrar por producto";
        modoHelp.textContent =
          "Usando Código de producto / Lote";
        if (fieldZona) fieldZona.style.display = "none";
        if (fieldSubzona) fieldSubzona.style.display = "none";
        if (fieldProducto) fieldProducto.style.display = "";
        if (fieldLote) fieldLote.style.display = "";
      }
      if (inputModo) inputModo.value = currentMode;
    }

    function getZonaParam() {
      if (currentMode === "ubicacion") {
        return optNombreZona();
      }
      return (inputProducto ? inputProducto.value : "").trim();
    }

    function getSubzonaParam() {
      if (currentMode === "ubicacion") {
        return optNombreSub();
      }
      return (inputLote ? inputLote.value : "").trim();
    }

    // Cargar productos únicos
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
      } catch (e) {
        inputProducto.innerHTML =
          '<option value="">Error al cargar</option>';
      } finally {
        inputProducto.disabled = false;
      }
    }

    // Cargar lotes por producto
    async function loadLotes(codigo, selectedLote) {
      if (!inputLote || !urlLotes) return;

      inputLote.disabled = true;
      inputLote.innerHTML =
        '<option value="">Cargando lotes…</option>';

      try {
        const params = new URLSearchParams();
        if (codigo) params.set("codigo", codigo);

        const res = await fetch(
          `${urlLotes}?${params.toString()}`
        );
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
      } catch (e) {
        inputLote.innerHTML =
          '<option value="">Error al cargar lotes</option>';
      } finally {
        inputLote.disabled = false;
      }
    }

    async function loadResumen(page) {
      const zonaParam = getZonaParam();
      const subParam = getSubzonaParam();
      const pageSize = parseInt(
        pageSizeInp.value || "200",
        10
      );

      showLoader(true);
      tbody.innerHTML =
        '<tr><td colspan="10" class="empty">Cargando…</td></tr>';

      try {
        const qs = new URLSearchParams({
          modo: currentMode,
          zona: zonaParam,
          subzona: subParam,
          page,
          page_size: pageSize
        });

        const res = await fetch(
          `${URL_RESUMEN}?${qs.toString()}`
        );
        const json = await res.json();
        const items = json.data || [];

        tbody.innerHTML = "";
        if (items.length === 0) {
          tbody.innerHTML =
            '<tr><td colspan="10" class="empty">Sin datos para el filtro seleccionado.</td></tr>';
        } else {
          for (const row of items) {
            const tr = document.createElement("tr");

            const estado = row.estado || "";
            let estadoClass = "";
            const estadoLower = estado.toLowerCase();

            if (estadoLower.startsWith("ok")) {
              estadoClass = "status-ok";
            } else if (estadoLower.startsWith("pendiente")) {
              estadoClass = "status-pend";
            }

            // Subíndices de conteo: intentamos con C1/C2/C3/C4 en mayúscula y minúscula
            const g1Tag = row.C1 || row.c1 || "";
            const g2Tag = row.C2 || row.c2 || "";
            const g3Tag = row.C3 || row.c3 || "";
            const g4Tag = row.C4 || row.c4 || "";

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
    <td class="status ${estadoClass}">${estado}</td>
  `;
            tbody.appendChild(tr);
          }


        }

        currentPage = page;
        pageInfo.textContent = `Página ${currentPage}`;

        const modoRespuesta =
          json.modo || currentMode || "ubicacion";
        if (modoRespuesta === "producto") {
          infoLabel.textContent = `Producto: ${json.zona || "—"
            } • Lote: ${json.subzona || "—"} • Filas: ${items.length
            }`;
        } else {
          infoLabel.textContent = `Zona: ${json.zona || "—"
            } • Subzona: ${json.subzona || "—"} • Filas: ${items.length
            }`;
        }

        btnPrev.disabled = currentPage <= 1;
        btnNext.disabled = items.length < pageSize;
      } catch (e) {
        tbody.innerHTML =
          '<tr><td colspan="10" class="empty">Ocurrió un error al cargar los datos.</td></tr>';
      } finally {
        showLoader(false);
      }
    }

    // --- Eventos ---
    if (zonaSelect && subzonaSelect) {
      zonaSelect.addEventListener("change", () => {
        if (currentMode !== "ubicacion") return;
        currentPage = 1;
        loadResumen(currentPage);
      });

      subzonaSelect.addEventListener("change", () => {
        if (currentMode !== "ubicacion") return;
        currentPage = 1;
        loadResumen(currentPage);
      });
    }

    pageSizeInp.addEventListener("change", () => {
      currentPage = 1;
      loadResumen(currentPage);
    });

    btnPrev.addEventListener("click", () => {
      if (currentPage <= 1) return;
      currentPage -= 1;
      loadResumen(currentPage);
    });

    btnNext.addEventListener("click", () => {
      currentPage += 1;
      loadResumen(currentPage);
    });

    if (btnRefresh) {
      btnRefresh.addEventListener("click", () => {
        currentPage = 1;
        loadResumen(currentPage);
      });
    }

    if (toggleModo) {
      toggleModo.addEventListener("click", () => {
        currentMode =
          currentMode === "ubicacion"
            ? "producto"
            : "ubicacion";
        syncModoUI();
        currentPage = 1;
        loadResumen(currentPage);
      });
    }

    if (inputProducto) {
      inputProducto.addEventListener("change", () => {
        const codigo = inputProducto.value || "";
        loadLotes(codigo, null);
        currentPage = 1;
        loadResumen(currentPage);
      });
    }

    if (inputLote) {
      inputLote.addEventListener("change", () => {
        currentPage = 1;
        loadResumen(currentPage);
      });
    }

    if (btnExport) {
      btnExport.addEventListener("click", () => {
        const zona = getZonaParam();
        const subzona = getSubzonaParam();
        const qs = new URLSearchParams({
          modo: currentMode,
          zona,
          subzona
        });
        window.open(
          `${URL_EXPORT}?${qs.toString()}`,
          "_blank"
        );
      });
    }

    // Inicialización
    syncModoUI();

    // Precargar productos (para modo producto)
    if (inputProducto && urlProductos) {
      loadProductos(null);
    }

    // Primera carga (modo por defecto: ubicación)
    loadResumen(1);
  })();
});