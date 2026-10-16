"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { funnyAvatar } from "@/lib/funny-avatar";
import { avatarUrl } from "@/lib/avatar-url";

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
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

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

  useEffect(() => {
    // l'erreur a pu arriver avant l'hydratation, onError ne se déclenchera pas
    const img = imgRef.current;
    setFailed(!!img && img.complete && img.naturalWidth === 0);
  }, [src]);

  const fallback = !src || failed ? funnyAvatar(login) : null;
  const shown = fallback?.src ?? avatarUrl(src)!;
  const shownLarge = fallback?.src ?? avatarUrl(large ?? src)!;

  return (
    <>
      <button
        type="button"
        className="avatar-btn"
        onClick={() => setOpen(true)}
        aria-label={`Voir la photo de ${login}`}
      >
        <img
          ref={imgRef}
          className={className}
          src={shown}
          alt={alt}
          title={fallback?.title}
          loading="lazy"
          onError={() => setFailed(true)}
        />
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
              <img src={shownLarge} alt={alt} className="modal-img" />
              <div className="modal-caption">
                <div className="modal-login">{login}</div>
                {fullName && <div className="modal-fullname">{fullName}</div>}
                {fallback && (
                  <div className="modal-fullname">« {fallback.title} »</div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
