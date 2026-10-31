const DIALOG_ID = "kexu-reminder-dialog";

export function showReminderDialog(
  document: Document,
  title: string,
  body: string,
) {
  document.getElementById(DIALOG_ID)?.remove();

  const overlay = document.createElement("div");
  overlay.id = DIALOG_ID;
  overlay.style.cssText =
    "position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.48);box-sizing:border-box";

  const dialog = document.createElement("div");
  dialog.setAttribute("role", "alertdialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "kexu-reminder-title");
  dialog.style.cssText =
    "width:100%;max-width:360px;padding:22px;border-radius:8px;background:#fff;color:#17211f;box-shadow:0 18px 48px rgba(0,0,0,.28);font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box";

  const heading = document.createElement("h2");
  heading.id = "kexu-reminder-title";
  heading.textContent = title;
  heading.style.cssText = "margin:0 0 10px;font-size:21px;line-height:1.35";

  const detail = document.createElement("p");
  detail.textContent = body;
  detail.style.cssText =
    "margin:0 0 20px;font-size:16px;line-height:1.65;color:#45534f;overflow-wrap:anywhere";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "知道了";
  close.style.cssText =
    "width:100%;min-height:48px;border:0;border-radius:8px;background:#18745d;color:#fff;font-size:16px;font-weight:700;cursor:pointer";
  close.addEventListener("click", () => overlay.remove());

  dialog.append(heading, detail, close);
  overlay.append(dialog);
  document.body.append(overlay);
  close.focus();
}
