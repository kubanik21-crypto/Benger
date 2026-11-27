package io.github.kubanik21crypto.benger;

/** Resource policy for Google's Picker only. Account cookie probes are not an OAuth login flow. */
final class RecipePickerWebPolicy {
    static boolean allows(String scheme,String host,String path,String method) {
        if (!"https".equals(scheme)||host==null) return false;
        if ("accounts.google.com".equals(host)) {
            if ("/ListAccounts".equals(path)) return "GET".equals(method)||"POST".equals(method);
            return "GET".equals(method)&&("/CheckCookie".equals(path)||"/RotateCookiesPage".equals(path));
        }
        return "apis.google.com".equals(host)||"docs.google.com".equals(host)||"drive.google.com".equals(host)
            ||host.endsWith(".googleapis.com")||host.endsWith(".gstatic.com")||host.endsWith(".googleusercontent.com");
    }
}
