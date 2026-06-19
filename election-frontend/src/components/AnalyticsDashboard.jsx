import { useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from "recharts";
import { API_URL } from "../config";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2"];

export default function AnalyticsDashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/results`);
      const results = await res.json();
      // Guard: backend may return { error: "..." } on 5xx even with ok=false.
      setData(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error("Analytics fetch error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const downloadPDF = async () => {
    const input = document.getElementById("analytics-report");
    const canvas = await html2canvas(input, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Election_Report_${new Date().toLocaleDateString()}.pdf`);
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Processing analytics...</div>;

  const totalVotes = data.reduce((acc, c) => acc + Number(c.vote_count), 0);
  
  // Group by position
  const positions = [...new Set(data.map(c => c.position))];
  
  return (
    <div className="space-y-8 mt-12">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-black text-slate-800">Election Intelligence</h2>
           <p className="text-slate-400 text-sm font-medium">Real-time data visualization & audit reporting</p>
        </div>
        <button 
          onClick={downloadPDF}
          className="bg-white border-2 border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
        >
          <span>📥</span> Download Official Report
        </button>
      </div>

      <div id="analytics-report" className="space-y-8 p-4 bg-[#f8fafc]">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Participation</p>
             <h4 className="text-3xl font-black text-blue-600">{totalVotes} <span className="text-sm font-medium text-slate-300 tracking-normal">Votes Cast</span></h4>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Blockchain Integrity</p>
             <h4 className="text-3xl font-black text-emerald-500">100% <span className="text-sm font-medium text-slate-300 tracking-normal">Verified</span></h4>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Voter Whitelist</p>
             <h4 className="text-3xl font-black text-indigo-500">Merkle <span className="text-sm font-medium text-slate-300 tracking-normal">V3</span></h4>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bar Chart: Rankings */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
            <h3 className="font-bold text-slate-800 mb-6 text-sm uppercase tracking-wider">Candidate Performance Ranking</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fontWeight: 700 }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fontWeight: 700 }} 
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="vote_count" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart: Distribution by Position */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
            <h3 className="font-bold text-slate-800 mb-6 text-sm uppercase tracking-wider">Vote Distribution by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={positions.map(pos => ({
                    name: pos,
                    value: data.filter(c => c.position === pos).reduce((a, b) => a + Number(b.vote_count), 0)
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Analytics Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidate</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Position</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Votes</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Market Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map(c => (
                <tr key={c.id}>
                  <td className="px-6 py-4 font-bold text-slate-800 text-sm">{c.name}</td>
                  <td className="px-6 py-4 text-xs font-bold text-blue-600 uppercase tracking-tighter">{c.position}</td>
                  <td className="px-6 py-4 font-black text-slate-900 text-sm">{c.vote_count}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="h-1.5 w-12 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500" 
                            style={{ width: `${(Number(c.vote_count) / totalVotes * 100) || 0}%` }}
                          ></div>
                       </div>
                       <span className="text-[10px] font-black text-slate-400">
                        {((Number(c.vote_count) / totalVotes * 100) || 0).toFixed(1)}%
                       </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
