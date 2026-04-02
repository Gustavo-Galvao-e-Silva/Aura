type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(12, 18, 14, 0.72)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl p-6 shadow-2xl"
        style={{
          background: "#2C3930",
          border: "1px solid rgba(162,123,92,0.2)",
          color: "#DCD7C9",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
