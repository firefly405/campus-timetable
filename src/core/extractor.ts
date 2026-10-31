// Runs in the school's WebView. Reads rendered course cells only, never inputs,
// cookies, storage, scripts or authentication values.
export function extractCourseDOM(doc: Document) {
  const tables = Array.from(doc.querySelectorAll("table")).filter((t) => {
    const headers = Array.from(t.querySelectorAll("thead th")).map((c) =>
      c.textContent?.trim(),
    );
    return (
      headers[0] === "课程号" &&
      headers.includes("课序号") &&
      headers.includes("地点")
    );
  });
  const banner = Array.from(doc.querySelectorAll("a"))
    .map((a) => a.textContent ?? "")
    .find((t) => /\d{4}-\d{4}.+第\s*\d+\s*周/.test(t));
  if (!banner || tables.length !== 1) return null;
  const term = banner.match(/(\d{4}-\d{4}\s*.+?)\s*第\s*(\d+)\s*周/);
  if (!term) return null;
  const periods = Array.from(
    doc.querySelectorAll("#courseTable tbody tr"),
  ).flatMap((row, i) => {
    const label = Array.from(row.querySelectorAll("th"))
      .map((c) => c.textContent ?? "")
      .find((t) => /节\(/.test(t));
    const match = label?.match(/\((\d{2}:\d{2})-(\d{2}:\d{2})\)/);
    return match ? [{ period: i + 1, start: match[1], end: match[2] }] : [];
  });
  const rows = Array.from(tables[0].querySelectorAll("tbody tr")).map((row) =>
    Array.from(row.children).map((cell) => ({
      text: cell.textContent?.trim() ?? "",
      rowSpan: Number(cell.getAttribute("rowspan") ?? 1),
      colSpan: Number(cell.getAttribute("colspan") ?? 1),
    })),
  );
  if (!rows.length || !periods.length) return null;
  return {
    source: "urp-dom-v1",
    term: term[1].trim(),
    currentWeek: Number(term[2]),
    capturedAt: new Date().toISOString(),
    headers: Array.from(tables[0].querySelectorAll("thead th")).map(
      (c) => c.textContent?.trim() ?? "",
    ),
    rows,
    periods,
  };
}

export function bridgeScript(requestId: number): string {
  return `(function(){
    var extract=${extractCourseDOM.toString()};
    var attempts=0, previous='', stable=0, sent=false;
    function run(){
      if(sent) return;
      try {
        var data=extract(document);
        if(data){
          var key=JSON.stringify([data.term,data.headers,data.rows,data.periods]);
          stable=key===previous?stable+1:0; previous=key;
          if(stable>=2){sent=true; window.ReactNativeWebView.postMessage(JSON.stringify({requestId:${requestId},data:data})); return;}
        }
      }catch(e){}
      if(++attempts<40) setTimeout(run,500);
      else window.ReactNativeWebView.postMessage(JSON.stringify({requestId:${requestId},error:'课表未完整加载，请稍后重试'}));
    }
    run();
  })();true;`;
}
