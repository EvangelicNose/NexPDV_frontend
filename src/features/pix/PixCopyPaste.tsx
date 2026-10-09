import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

export function PixCopyPaste({ payload }: { payload: string }) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [feedback, setFeedback] = useState("");
  useEffect(() => setFeedback(""), [payload]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setFeedback("Código Pix copiado.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setFeedback(
        "Não foi possível copiar automaticamente. Selecione e copie o código abaixo.",
      );
    }
  };
  return (
    <section className="pix-copy">
      <label htmlFor="pix-copy-paste">Pix Copia e Cola</label>
      <textarea
        ref={input}
        id="pix-copy-paste"
        readOnly
        rows={3}
        value={payload}
        onFocus={(event) => event.target.select()}
      />
      <button
        type="button"
        className="secondary-button flex justify-center items-center gap-2"
        onClick={() => void copy()}
      >
        {feedback === "Código Pix copiado." ? (
          <Check size={17} />
        ) : (
          <Copy size={17} />
        )}{" "}
        Copiar Pix
      </button>
      {feedback && <p role="status">{feedback}</p>}
    </section>
  );
}
