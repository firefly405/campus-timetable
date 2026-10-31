function prepare(context) {
  if (context.env?.SCHOOL_SESSION_KEY)
    process.env.SCHOOL_SESSION_KEY = context.env.SCHOOL_SESSION_KEY;
  return context.request;
}

async function run(method, context) {
  try {
    const school = (await import("./school-api.js")).default;
    return school[method](prepare(context));
  } catch (error) {
    console.error("School function startup failed", error);
    return Response.json({ error: "学校服务暂时无法启动" }, { status: 502 });
  }
}

export function onRequestGet(context) {
  return run("GET", context);
}

export function onRequestPost(context) {
  return run("POST", context);
}

export function onRequestDelete(context) {
  return run("DELETE", context);
}
