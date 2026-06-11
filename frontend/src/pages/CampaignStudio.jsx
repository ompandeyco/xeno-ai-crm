import React, { useState } from 'react';
import { Sparkles, ArrowRight, CheckCircle2, Play, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

const CampaignStudio = () => {
  const navigate = useNavigate();
  const [goal, setGoal] = useState('');
  const [channel, setChannel] = useState('email');
  
  const [step, setStep] = useState(0); // 0: Input, 1: Generating Segment, 2: Generating Message, 3: Ready
  const [segmentData, setSegmentData] = useState(null);
  const [messageData, setMessageData] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    
    try {
      setError(null);
      setStep(1); // Generating Segment
      
      const segRes = await api.post('/ai/segment', { goal });
      const seg = segRes.data.data;
      setSegmentData(seg);
      
      setStep(2); // Generating Message
      
      const msgRes = await api.post('/ai/message', {
        goal,
        segment: { segmentName: seg.segmentName, rules: seg.rules },
        channel
      });
      setMessageData(msgRes.data.data);
      
      setStep(3); // Ready
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'AI generation failed. Please try again.');
      setStep(0);
    }
  };

  const handleLaunch = async () => {
    try {
      setError(null);
      // 1. Create campaign
      const rulesArray = Object.entries(segmentData.rules).map(([key, val]) => {
        return {
          field: key === 'minSpend' ? 'purchaseSummary.totalSpend' : 'engagement.lastPurchaseDate',
          operator: key === 'minSpend' ? 'gte' : 'gte',
          value: val
        };
      });

      const campRes = await api.post('/campaigns', {
        name: `AI Campaign: ${segmentData.segmentName}`,
        goal,
        segmentRules: [],
        message: messageData.message,
        channel
      });
      
      const campaignId = campRes.data.data._id;
      
      // 2. Launch campaign
      await api.post(`/campaigns/${campaignId}/launch`);
      
      navigate('/analytics');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to launch campaign.');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">AI Campaign Studio</h1>
        <p className="text-lg text-gray-500 mt-2 max-w-2xl mx-auto">
          Describe what you want to achieve. The AI will build the audience segment, write the copy, and orchestrate the campaign.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Step 1: User Intent */}
        <div className="p-8 bg-gradient-to-br from-indigo-900 to-indigo-800 relative">
          <div className="absolute top-4 right-4 bg-indigo-800/50 px-3 py-1 rounded-full border border-indigo-700">
            <span className="text-indigo-200 text-xs font-semibold tracking-wider uppercase">Step 1: User Intent</span>
          </div>
          <label className="block text-indigo-100 font-medium mb-2 mt-4">Campaign Goal</label>
          <div className="relative">
            <textarea
              className="w-full bg-white/10 border border-white/20 rounded-xl p-4 text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
              rows={3}
              placeholder="e.g., Bring back premium customers who haven't purchased recently"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={step > 0}
            />
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <label className="text-indigo-200 text-sm">Channel:</label>
              <select 
                className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none"
                value={channel}
                onChange={e => setChannel(e.target.value)}
                disabled={step > 0}
              >
                <option value="email" className="text-gray-900">Email</option>
                <option value="whatsapp" className="text-gray-900">WhatsApp</option>
                <option value="sms" className="text-gray-900">SMS</option>
              </select>
            </div>
            
            {step === 0 && (
              <button 
                onClick={handleGenerate}
                disabled={!goal.trim()}
                className="flex items-center gap-2 bg-white text-indigo-900 px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                Generate AI Campaign <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Loading & Results Section */}
        {step > 0 && (
          <div className="p-8 space-y-8 bg-gray-50/50">
            {/* Step 2: AI Audience Selection */}
            <div className={`transition-opacity duration-500 ${step >= 1 ? 'opacity-100' : 'opacity-0 hidden'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">2</div>
                <h3 className="font-bold text-gray-900 text-lg">AI Audience Selection</h3>
                {step > 1 ? <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto" /> : <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin ml-auto" />}
              </div>
              
              {segmentData && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm ml-11">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-gray-900 text-lg">{segmentData.segmentName}</span>
                    {segmentData.fallback && <span className="text-xs font-medium px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">Fallback Mode</span>}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {Object.entries(segmentData.rules).map(([k, v]) => (
                      <div key={k} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-500 uppercase font-semibold">{k}</p>
                        <p className="font-mono text-gray-900 mt-1">{v}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-blue-50/50 p-4 rounded-lg text-sm text-blue-900 border border-blue-100">
                    <span className="font-semibold mr-2">Why AI chose this:</span>
                    {segmentData.reasoning}
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: AI Message Generation */}
            <div className={`transition-opacity duration-500 ${step >= 2 ? 'opacity-100' : 'opacity-0 hidden'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">3</div>
                <h3 className="font-bold text-gray-900 text-lg">AI Message Generation</h3>
                {step > 2 ? <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto" /> : step === 2 ? <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin ml-auto" /> : null}
              </div>
              
              {messageData && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm ml-11">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">
                      Tone: {messageData.tone}
                    </span>
                    {messageData.fallback && <span className="text-xs font-medium px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">Fallback Mode</span>}
                  </div>
                  
                  <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-gray-800 text-lg whitespace-pre-wrap leading-relaxed shadow-inner">
                    {messageData.message}
                  </div>
                  
                  <div className="mt-4 text-sm text-gray-500 italic">
                    <span className="font-medium mr-2 not-italic">Why AI chose this:</span>
                    {messageData.reason}
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Action Bar */}
            {step === 3 && (
              <div className="ml-11 flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs">4</span>
                  Ready to launch
                </div>
                <div className="flex items-center">
                  <button 
                    onClick={() => setStep(0)} 
                    className="px-6 py-2.5 text-gray-600 font-medium hover:text-gray-900 mr-4"
                  >
                    Start Over
                  </button>
                  <button 
                    onClick={handleLaunch}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    Launch Campaign
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignStudio;
