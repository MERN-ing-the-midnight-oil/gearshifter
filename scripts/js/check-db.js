const { createClient } = require('@supabase/supabase-js');

// Get from environment or use the values from APPLY_MIGRATIONS.md
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://spozqnkfwltgxqrokpaj.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable__2MqLALVBMuJkizWl7EoiA_LrmH61dh';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('🔍 Checking Supabase database...\n');
  console.log(`URL: ${supabaseUrl}\n`);

  // Check events
  console.log('📅 Checking events...');
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .limit(10);
  
  if (eventsError) {
    console.error('❌ Error fetching events:', eventsError.message);
  } else {
    console.log(`✅ Found ${events.length} event(s):`);
    events.forEach(event => {
      console.log(`   - ${event.name} (ID: ${event.id}, Status: ${event.status})`);
    });
  }

  // Check organizations
  console.log('\n🏢 Checking organizations...');
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('*')
    .limit(10);
  
  if (orgsError) {
    console.error('❌ Error fetching organizations:', orgsError.message);
  } else {
    console.log(`✅ Found ${orgs.length} organization(s):`);
    orgs.forEach(org => {
      console.log(`   - ${org.name} (ID: ${org.id})`);
    });
  }

  // Check sellers
  console.log('\n👤 Checking sellers...');
  const { data: sellers, error: sellersError } = await supabase
    .from('sellers')
    .select('id, first_name, last_name, phone')
    .limit(10);
  
  if (sellersError) {
    console.error('❌ Error fetching sellers:', sellersError.message);
  } else {
    console.log(`✅ Found ${sellers.length} seller(s):`);
    sellers.forEach(seller => {
      console.log(`   - ${seller.first_name} ${seller.last_name} (${seller.phone})`);
    });
  }

  // Check items
  console.log('\n📦 Checking items...');
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('id, item_number, category, status')
    .limit(10);
  
  if (itemsError) {
    console.error('❌ Error fetching items:', itemsError.message);
  } else {
    console.log(`✅ Found ${items.length} item(s):`);
    items.forEach(item => {
      console.log(`   - ${item.item_number} (${item.category}, ${item.status})`);
    });
  }

  // Check admin_users
  console.log('\n👨‍💼 Checking admin users...');
  const { data: admins, error: adminsError } = await supabase
    .from('admin_users')
    .select('id, first_name, last_name, email')
    .limit(10);
  
  if (adminsError) {
    console.error('❌ Error fetching admin users:', adminsError.message);
  } else {
    console.log(`✅ Found ${admins.length} admin user(s):`);
    admins.forEach(admin => {
      console.log(`   - ${admin.first_name} ${admin.last_name} (${admin.email})`);
    });
  }

  console.log('\n✨ Database check complete!');
}

checkDatabase().catch(console.error);

