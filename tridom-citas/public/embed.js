/* Tridom Citas · código para poner el formulario de cita dentro de la web del taller.
   <script src="https://citas.tudominio.es/embed.js" data-taller="IDENTIFICADOR"></script>
   Crea un iframe justo debajo de esta etiqueta y lo ajusta a la altura del formulario. */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var id = s.getAttribute('data-taller');
  if (!id) return;
  var f = document.createElement('iframe');
  f.src = new URL(s.src).origin + '/?taller=' + encodeURIComponent(id) + '&embed=1';
  f.title = 'Pedir cita';
  f.loading = 'lazy';
  f.style.cssText = 'width:100%;border:0;display:block;min-height:640px;background:transparent';
  s.parentNode.insertBefore(f, s.nextSibling);
  window.addEventListener('message', function (e) {
    if (e.source !== f.contentWindow) return; // solo hace caso a su propio iframe
    var d = e.data;
    if (d && d.source === 'tridom-citas' && d.type === 'height' && typeof d.height === 'number') f.style.height = Math.ceil(d.height) + 'px';
  });
})();
