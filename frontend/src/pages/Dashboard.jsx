import React, { useState, useEffect } from 'react';
import { Users, Mail, TrendingUp, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import api from '../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalCampaigns: 0,
    messagesSent: 0,
    avgEngagement: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mock data for charts to make the dashboard look populated
  const performanceData = [
    { name: 'Mon', sent: 4000, opened: 2400 },
    { name: 'Tue', sent: 3000, opened: 1398 },
    { name: 'Wed', sent: 2000, opened: 9800 },
    { name: 'Thu', sent: 2780, opened: 3908 },
    { name: 'Fri', sent: 1890, opened: 4800 },
    { name: 'Sat', sent: 2390, opened: 3800 },
    { name: 'Sun', sent: 3490, opened: 4300 },
  ];

  const channelData = [
    { name: 'WhatsApp', value: 65 },
    { name: 'Email', value: 25 },
    { name: 'SMS', value: 10 },
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [customersRes, campaignsRes] = await Promise.all([
          api.get('/customers?limit=1'),   // We only need the pagination total, not all records
          api.get('/campaigns')
        ]);
        
        // Total comes from pagination metadata — data.length is just the current page size
        const customersCount = customersRes.data.pagination?.totalCustomers || 0;
        const campaigns = campaignsRes.data.data || [];
        const totalCampaigns = campaigns.length;
        
        let messagesSent = 0;
        let totalOpened = 0;
        let campaignsWithStats = 0;
        
        campaigns.forEach(c => {
          messagesSent += (c.stats?.sent || 0);
          totalOpened += (c.stats?.opened || 0);
          if (c.stats?.sent > 0) campaignsWithStats++;
        });

        const avgEngagement = messagesSent > 0 ? ((totalOpened / messagesSent) * 100).toFixed(1) : 0;

        setStats({
          totalCustomers: customersCount,
          totalCampaigns,
          messagesSent,
          avgEngagement: Number(avgEngagement)
        });
      } catch (err) {
        console.error('Failed to load dashboard stats', err);
        setError('Failed to load dashboard metrics. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, Om</h1>
        <p className="text-gray-500">Here's what's happening with your marketing campaigns today.</p>
      </div>

      {error ? (
        <div className="bg-red-50 text-red-800 p-4 rounded-xl mb-8 border border-red-100">
          {error}
        </div>
      ) : loading ? (
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon={<Users />} label="Total Customers" value={stats.totalCustomers} trend="+12%" />
          <StatCard icon={<Mail />} label="Campaigns Launched" value={stats.totalCampaigns} trend="+2 this week" />
          <StatCard icon={<TrendingUp />} label="Messages Sent" value={stats.messagesSent.toLocaleString()} trend="High Volume" />
          <StatCard icon={<Activity />} label="Avg. Engagement" value={`${stats.avgEngagement}%`} trend="+4.2%" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Campaign Performance (7 Days)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="opened" stackId="1" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.2} />
                <Area type="monotone" dataKey="sent" stackId="1" stroke="#818CF8" fill="#818CF8" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Channel Breakdown</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="vertical" margin={{top: 0, right: 0, left: 0, bottom: 0}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#4B5563', fontSize: 13}} width={80} />
                <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="value" fill="#4F46E5" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, trend }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-start justify-between group hover:border-indigo-100 transition-colors">
    <div>
      <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
      <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
      <p className="text-xs font-medium text-emerald-600 mt-2 bg-emerald-50 inline-block px-2 py-0.5 rounded-full">{trend}</p>
    </div>
    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
      {React.cloneElement(icon, { className: 'w-5 h-5' })}
    </div>
  </div>
);

export default Dashboard;
