import { useState } from 'react';

type Props = {
  images: string[];
  name: string;
};

export default function ImageGallery({ images, name }: Props) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (images.length === 0) {
    return (
      <div className="image-gallery empty">
        <div className="image-gallery-placeholder">No images</div>
      </div>
    );
  }

  const current = images[index % images.length];
  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  return (
    <>
      <div className="image-gallery">
        <div className="image-gallery-main" onClick={() => setLightbox(true)}>
          <img src={current} alt={`${name} view ${index + 1}`} />
        </div>
        {images.length > 1 && (
          <div className="image-gallery-nav">
            <button type="button" onClick={prev} aria-label="Previous image">‹</button>
            <span className="image-gallery-nav-counter" aria-live="polite">{index + 1} / {images.length}</span>
            <button type="button" onClick={next} aria-label="Next image">›</button>
          </div>
        )}
        {images.length > 1 && (
          <div className="image-gallery-thumbs-wrap">
            <div className="image-gallery-thumbs" aria-hidden="true">
              {images.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  className={i === index ? 'active' : ''}
                  onClick={() => setIndex(i)}
                >
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
            {/* Overlay to cover any stray character that can appear below thumbs */}
            <div className="image-gallery-thumbs-cover" aria-hidden="true" />
          </div>
        )}
      </div>
      {lightbox && (
        <div
          className="lightbox"
          role="dialog"
          aria-label="Enlarged image"
          onClick={() => setLightbox(false)}
        >
          <button type="button" className="lightbox-close" onClick={() => setLightbox(false)} aria-label="Close">×</button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={current} alt={name} />
            {images.length > 1 && (
              <>
                <button type="button" className="lightbox-prev" onClick={prev} aria-label="Previous">‹</button>
                <button type="button" className="lightbox-next" onClick={next} aria-label="Next">›</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
