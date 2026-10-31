import { SCHOOL_ORIGIN } from "./model.ts";

export const SCHOOL_LOGIN_URL = SCHOOL_ORIGIN + "/login";

export function supportsSchoolLoginURL(value: string): boolean {
  try {
    normalizeSchoolLoginURL(value);
    return true;
  } catch {
    return false;
  }
}

export function normalizeSchoolLoginURL(value: string): string {
  try {
    const url = new URL(value.trim());
    if (
      url.origin === SCHOOL_ORIGIN &&
      ["/", "/login"].includes(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    )
      return SCHOOL_LOGIN_URL;
  } catch {}
  throw new Error("目前仅支持湖北工业大学工程技术学院的已核实教务网址");
}

export function loginFillScript(username: string, password: string): string {
  return `(function(){
    if(location.origin!==${JSON.stringify(SCHOOL_ORIGIN)}||location.pathname!=="/login")return;
    var form=document.querySelector('form[action="/j_spring_security_check"]');
    var account=form&&form.querySelector('#input_username');
    var secret=form&&form.querySelector('#input_password');
    if(!account||!secret){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:"login-form-error"}));
      return;
    }
    account.value=${JSON.stringify(username)};
    secret.value=${JSON.stringify(password)};
    [account,secret].forEach(function(field){
      field.dispatchEvent(new Event("input",{bubbles:true}));
      field.dispatchEvent(new Event("change",{bubbles:true}));
    });
  })();true;`;
}
