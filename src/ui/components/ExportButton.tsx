export interface ExportButtonProps {
  /** Return a JSON string. Called only when the user asks to export. */
  getJson: () => string;
  /** Defaults to tinysteps-export.json. */
  filename?: string;
}

/**
 * Quiet local download. Not a sage primary.
 */
export function ExportButton({
  getJson,
  filename = "tinysteps-export.json",
}: ExportButtonProps) {
  function handleExport() {
    const blob = new Blob([getJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      aria-label="导出数据"
      className="min-h-12 rounded-full px-5 text-lg text-ink/55 ring-1 ring-stone-deep/80 transition hover:bg-white hover:text-ink"
    >
      导出数据
    </button>
  );
}
