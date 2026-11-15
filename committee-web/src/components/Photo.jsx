// Foto de ambiente. Si `photo.src` está vacío se dibuja un hueco con los haces de luz de la
// marca (no es una foto): el espacio queda reservado hasta que haya una imagen con derechos.
// Si la imagen es generada con IA, `photo.note` la declara en el pie.
export default function Photo({ photo, label, className = '' }) {
  const has = Boolean(photo?.src);
  return (
    <figure className={`photo ${has ? '' : 'photo--empty'} ${className}`}>
      {has ? (
        <img src={photo.src} alt={photo.alt || ''} loading="lazy" decoding="async" />
      ) : (
        <div className="photo__ph" role="img" aria-label={label}>
          <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <g fill="currentColor">
              <polygon points="20,0 34,0 60,100 8,100" opacity=".55" />
              <polygon points="70,0 84,0 118,100 62,100" opacity=".32" />
              <polygon points="120,0 134,0 160,100 108,100" opacity=".45" />
            </g>
          </svg>
          <span>{label}</span>
        </div>
      )}
      {has && photo.note ? <figcaption>{photo.note}</figcaption> : null}
    </figure>
  );
}
