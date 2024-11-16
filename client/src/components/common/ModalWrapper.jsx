import React from "react";

export default function ModalWrapper({ open, onClose, children, className }) {
  return (
    <div
      className={`fixed inset-0 flex justify-center items-center transition-colors ${
        open ? "visible bg-black/20 z-20" : "invisible"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`shadow-xl rounded-xl transition-all ${open ? "scale-100 opacity-100" : "scale-125 opacity-0"} ${className}`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 btn btn-sm btn-circle"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
