const axios = require('axios');

async function runTests() {
  const API = 'http://localhost:5001/api';
  console.log('--- STARTING QA TESTS ---');

  try {
    // 1. Create Customer
    console.log('\\n[1] Creating Customer...');
    const custRes = await axios.post(`${API}/customers`, {
      name: 'QA Test User',
      email: `qa-${Date.now()}@example.com`,
      phone: '+1234567890'
    });
    const customerId = custRes.data.data._id;
    console.log('✅ Customer created:', customerId);

    // 2. Create Order
    console.log('\\n[2] Creating Order for Customer...');
    await axios.post(`${API}/orders`, {
      customerId,
      items: [{ productName: 'Test Item', price: 5000, quantity: 1, category: 'Electronics' }]
    });
    console.log('✅ Order created');

    // Verify Customer Update
    const updatedCustRes = await axios.get(`${API}/customers/${customerId}`);
    const summary = updatedCustRes.data.data.purchaseSummary;
    if (summary.totalSpend === 5000 && summary.totalOrders === 1) {
      console.log('✅ Customer purchase summary updated correctly');
    } else {
      console.error('❌ Customer purchase summary incorrect:', summary);
    }

    // 3. AI Segment
    console.log('\\n[3] Testing AI Segment...');
    const segRes = await axios.post(`${API}/ai/segment`, {
      goal: 'Bring back premium customers who have not purchased recently'
    });
    const segment = segRes.data.data;
    console.log('✅ AI Segment:', segment.segmentName, segment.rules);

    // 4. AI Message
    console.log('\\n[4] Testing AI Message...');
    const msgRes = await axios.post(`${API}/ai/message`, {
      goal: 'Bring back premium customers',
      segment: segment,
      channel: 'email'
    });
    const message = msgRes.data.data.message;
    console.log('✅ AI Message generated (contains {{name}}):', message.includes('{{name}}') || message.includes('{name}'));

    // 5. Campaign Flow
    console.log('\\n[5] Testing Campaign Lifecycle...');
    
    // Create
    const campRes = await axios.post(`${API}/campaigns`, {
      name: 'QA Campaign',
      goal: 'Test',
      segmentRules: [{ field: 'purchaseSummary.totalSpend', operator: 'gte', value: 5000 }],
      message: 'Hello {{name}}',
      channel: 'email'
    });
    const campaignId = campRes.data.data._id;
    console.log('✅ Campaign created:', campaignId);

    // Preview
    const prevRes = await axios.post(`${API}/campaigns/preview`, {
      segmentRules: [{ field: 'purchaseSummary.totalSpend', operator: 'gte', value: 5000 }]
    });
    console.log(`✅ Audience preview: ${prevRes.data.data.count} matched`);

    // Launch
    await axios.post(`${API}/campaigns/${campaignId}/launch`);
    console.log('✅ Campaign launched');

    // Wait for channel service to process callbacks
    console.log('Waiting 3 seconds for channel service callbacks...');
    await new Promise(r => setTimeout(r, 3000));

    // Verify Campaign Stats
    const finalCampRes = await axios.get(`${API}/campaigns/${campaignId}`);
    const stats = finalCampRes.data.data.stats;
    console.log('✅ Campaign Stats:', stats);

    // Verify Communication Logs
    const logsRes = await axios.get(`${API}/campaigns/${campaignId}/logs`);
    const logs = logsRes.data.data;
    if (logs.length > 0) {
      console.log(`✅ Communication logs created: ${logs.length}`);
      console.log(`✅ Example status history:`, logs[0].statusHistory.map(h => h.status));
    } else {
      console.error('❌ No communication logs found');
    }

  } catch (err) {
    console.error('❌ TEST FAILED:', err.response ? err.response.data : err.message);
  }
}

runTests();
