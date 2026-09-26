const NPOINT_URL = "https://api.npoint.io/d7e7f8701a89c250d8c5";

export const db = {
  data: {
    profiles: [],
    campus_sessions: [],
    student_directory: [],
    complaints: []
  },
  
  async load() {
    if (!NPOINT_URL) {
      console.warn("No NPOINT_URL configured, using in-memory mock data.");
      return;
    }
    try {
      const res = await fetch(NPOINT_URL);
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json === 'object') {
          this.data = {
            profiles: json.profiles || [],
            campus_sessions: json.campus_sessions || [],
            student_directory: json.student_directory || [],
            complaints: json.complaints || []
          };
        }
      }
    } catch (e) {
      console.error("Failed to load from npoint:", e);
    }
  },

  async save() {
    if (!NPOINT_URL) {
      return;
    }
    try {
      await fetch(NPOINT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.data)
      });
    } catch (e) {
      console.error("Failed to save to npoint:", e);
    }
  }
};

export const admin = {
  check: async (req) => {
    await db.load();
    const hasAdmin = db.data.profiles.some(p => p.role === 'admin');
    return !hasAdmin;
  }
};
