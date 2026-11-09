import { fetchStudents } from "./api";

export async function downloadResultsCsv(): Promise<void> {
  try {
    const students = await fetchStudents();
    if (!students || students.length === 0) {
      alert("No student data available to download.");
      return;
    }

    const headers = [
      "USN",
      "Name",
      "Branch",
      "Total Marks",
      "Max Marks",
      "Percentage",
      "CGPA",
      "Total Backlogs",
      "GitHub",
      "LinkedIn",
    ];

    const rows = students.map((s) => [
      `"${s.usn || ""}"`,
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${s.branch || ""}"`,
      s.total_marks || 0,
      s.max_marks || 0,
      s.percentage || 0,
      s.cgpa || 0,
      s.total_backlogs || 0,
      `"${s.github_url || ""}"`,
      `"${s.linkedin_url || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vtu_results_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Export error:", err);
    alert("Failed to export results.");
  }
}
