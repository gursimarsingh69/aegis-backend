const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testUpload() {
  const fileBuffer = Buffer.from('hello world');
  console.log('Testing upload to assets bucket...');
  const { data, error } = await supabase.storage
    .from('assets')
    .upload('test.txt', fileBuffer, {
      contentType: 'text/plain',
      upsert: true
    });

  if (error) {
    console.error('Upload Error:', error);
  } else {
    console.log('Upload Success:', data);
  }
}

testUpload();
