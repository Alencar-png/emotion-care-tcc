// Função para obter a base da API - lê do arquivo .env
// O Next.js carrega automaticamente variáveis NEXT_PUBLIC_* do arquivo .env
export const getApiBase = (): string => {
  // Lê a variável de ambiente NEXT_PUBLIC_API_BASE_URL do arquivo .env
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  
  if (envUrl) {
    if (typeof window !== "undefined") {
      console.log("DEBUG: Using API_BASE from .env:", envUrl);
    }
    return envUrl;
  }
  
  // Fallback caso a variável não esteja definida no .env
  console.warn("DEBUG: NEXT_PUBLIC_API_BASE_URL not found in .env, using fallback http://localhost:4200/api");
  return "http://localhost:4200/api";
};

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }

  private getHeaders(isFormData = false): HeadersInit {
    const headers: HeadersInit = {};
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      // Token expirado ou inválido
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
      }
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: "Erro desconhecido.",
      }));
      let message: string;
      if (Array.isArray(error.detail)) {
        message = error.detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join("; ");
      } else if (typeof error.detail === "string") {
        message = error.detail;
      } else {
        message = `Erro ${response.status}`;
      }
      throw new Error(message);
    }

    return response.json();
  }

  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const API_BASE = getApiBase();
    // Se API_BASE já é uma URL completa (http://...), usar diretamente
    // Senão, construir URL completa com window.location.origin
    let baseUrl: string;
    if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
      baseUrl = API_BASE;
    } else {
      // Path relativo - construir URL completa
      baseUrl = `${window.location.origin}${API_BASE}`;
    }
    
    // Remover barra inicial do endpoint para garantir concatenação correta
    const endpointPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = new URL(endpointPath, `${cleanBase}/`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const API_BASE = getApiBase();
    // Se API_BASE já é uma URL completa (http://...), usar diretamente
    // Senão, construir URL completa com window.location.origin
    let baseUrl: string;
    if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
      baseUrl = API_BASE;
    } else {
      // Path relativo - construir URL completa
      baseUrl = `${window.location.origin}${API_BASE}`;
    }
    
    // Remover barra inicial do endpoint para garantir concatenação correta
    const endpointPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${cleanBase}/${endpointPath}`;
    
    console.log("DEBUG post: API_BASE=", API_BASE, "baseUrl=", baseUrl, "url=", url);
    
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const API_BASE = getApiBase();
    let baseUrl: string;
    if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
      baseUrl = API_BASE;
    } else {
      baseUrl = `${window.location.origin}${API_BASE}`;
    }
    
    // Remover barra inicial do endpoint para garantir concatenação correta
    const endpointPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${cleanBase}/${endpointPath}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const API_BASE = getApiBase();
    let baseUrl: string;
    if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
      baseUrl = API_BASE;
    } else {
      baseUrl = `${window.location.origin}${API_BASE}`;
    }

    // Remover barra inicial do endpoint para garantir concatenação correta
    const endpointPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = new URL(endpointPath, `${cleanBase}/`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  async uploadFile<T>(
    endpoint: string,
    file: File,
    params?: Record<string, unknown>
  ): Promise<T> {
    const API_BASE = getApiBase();
    let baseUrl: string;
    if (API_BASE.startsWith('http://') || API_BASE.startsWith('https://')) {
      baseUrl = API_BASE;
    } else {
      baseUrl = `${window.location.origin}${API_BASE}`;
    }
    
    // Remover barra inicial do endpoint para garantir concatenação correta
    const endpointPath = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = new URL(endpointPath, `${cleanBase}/`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: this.getHeaders(true),
      body: formData,
    });
    return this.handleResponse<T>(response);
  }
}

export const api = new ApiClient();
