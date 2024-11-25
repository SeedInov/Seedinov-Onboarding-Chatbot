declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENAI_API_KEY: string
      REACT_APP_LOCAL_RELAY_SERVER_URL: string
      REACT_APP_LOCAL_BASEURL: string
    }
  }
}

export {}