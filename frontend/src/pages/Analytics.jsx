import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Mail, CheckCircle2, MousePointerClick, RefreshCcw, Sparkles } from 'lucide-react';

const Analytics = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // States for insights modal/drawer
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/campaigns');
      setCampaigns(res.data.data);
    } catch (err) {
      console.error('Failed to fetch campaigns', err);
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async (campaign) => {
    if (campaign.status === 'draft') return;
    
    setSelectedCampaign(campaign);
    setInsightsLoading(true);
    setInsights(null);
    
    try {
      const res = await api.get(`/ai/insights/${campaign._id}`);
      setInsights(res.data.data.insights);
    } catch (err) {
      console.error(err);
      setInsights({
        summary: 'Failed to load insights.',
        recommendations: []
      });
    } finally {
      setInsightsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto flex gap-8">
      {/* Main List */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campaign Analytics</h1>
            <p className="text-gray-500">Track delivery and engagement</p>
          </div>
          <button onClick={fetchCampaigns} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-xl border border-gray-200 animate-pulse" />
            ))
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500">No campaigns launched yet.</p>
            </div>
          ) : (
            campaigns.map(camp => (
              <div 
                key={camp._id} 
                onClick={() => loadInsights(camp)}
                className={`bg-white rounded-xl border p-6 cursor-pointer transition-all hover:shadow-md ${selectedCampaign?._id === camp._id ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-md' : 'border-gray-200'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{camp.name}</h3>
                      <p className="text-xs text-gray-500 uppercase font-semibold mt-0.5">{camp.channel} • {new Date(camp.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    camp.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                    camp.status === 'sending' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {camp.status}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-4 pt-4 border-t border-gray-100">
                  <StatItem label="Audience" value={camp.stats.audienceSize} />
                  <StatItem label="Sent" value={camp.stats.sent} />
                  <StatItem label="Delivered" value={camp.stats.delivered} icon={<CheckCircle2 className="w-3 h-3 text-emerald-500 ml-1 inline" />} />
                  <StatItem label="Opened" value={camp.stats.opened} />
                  <StatItem label="Clicked" value={camp.stats.clicked} icon={<MousePointerClick className="w-3 h-3 text-blue-500 ml-1 inline" />} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Insights Panel */}
      <div className="w-96 shrink-0">
        <div className="sticky top-8">
          <div className="bg-gradient-to-b from-indigo-900 to-indigo-800 rounded-2xl shadow-xl overflow-hidden border border-indigo-700">
            <div className="p-5 border-b border-white/10 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-indigo-300" />
              <h2 className="text-white font-bold">AI Insights</h2>
            </div>
            
            <div className="p-6 min-h-[400px]">
              {!selectedCampaign ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-indigo-200 mt-20">
                  <Mail className="w-12 h-12 mb-4 opacity-50" />
                  <p>Select a completed campaign to view AI analysis and recommendations.</p>
                </div>
              ) : selectedCampaign.status === 'draft' ? (
                <div className="text-indigo-200 text-center mt-20">
                  <p>Launch this campaign to get insights.</p>
                </div>
              ) : insightsLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-white/20 rounded w-3/4"></div>
                  <div className="h-4 bg-white/20 rounded w-full"></div>
                  <div className="h-4 bg-white/20 rounded w-5/6"></div>
                </div>
              ) : insights ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-2">Summary</h3>
                    <p className="text-white text-sm leading-relaxed">{insights.summary}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3">Recommendations</h3>
                    <ul className="space-y-3">
                      {insights.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-3 bg-white/10 p-3 rounded-lg border border-white/5">
                          <div className="w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">{i+1}</div>
                          <p className="text-indigo-100 text-sm leading-tight">{rec}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatItem = ({ label, value, icon }) => (
  <div>
    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
    <p className="text-lg font-bold text-gray-900">{value} {icon}</p>
  </div>
);

export default Analytics;
