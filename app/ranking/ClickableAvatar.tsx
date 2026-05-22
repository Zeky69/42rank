"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  src: string | null;
  large?: string | null;
  alt: string;
  login: string;
  fullName?: string;
  className?: string;
};

export default function ClickableAvatar({
  src,
  large,
  alt,
  login,
  fullName,
  className = "avatar",
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!src) {
    return (
      <div className={`${className} avatar-fallback`}>
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="avatar-btn"
        onClick={() => setOpen(true)}
        aria-label={`Voir la photo de ${login}`}
      >
        <img className={className} src={src} alt={alt} loading="lazy" />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-inner" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="modal-close"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
              >
                ×
              </button>
              <img src={large ?? src} alt={alt} className="modal-img" />
              <div className="modal-caption">
                <div className="modal-login">{login}</div>
                {fullName && <div className="modal-fullname">{fullName}</div>}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
