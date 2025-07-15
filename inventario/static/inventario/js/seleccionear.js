// static/inventario/js/seleccionar.js

document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("form-seleccion");

    if (!form) return;

    form.addEventListener("submit", function (event) {
        let grupo = document.getElementById("grupo");
        let conteo = document.getElementById("conteo");
        let zona = document.getElementById("zona");

        let valid = true;

        // Validaciones
        if (!grupo.value) {
            document.getElementById("error-grupo").style.display = "block";
            valid = false;
        } else {
            document.getElementById("error-grupo").style.display = "none";
        }

        if (!conteo.value) {
            document.getElementById("error-conteo").style.display = "block";
            valid = false;
        } else {
            document.getElementById("error-conteo").style.display = "none";
        }

        if (!zona.value) {
            document.getElementById("error-zona").style.display = "block";
            valid = false;
        } else {
            document.getElementById("error-zona").style.display = "none";
        }

        if (!valid) {
            event.preventDefault();
        }
    });
});