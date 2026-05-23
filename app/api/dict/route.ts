import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { word, config } = await request.json()
    if (!word) {
      return NextResponse.json({ error: 'Thiếu từ vựng' }, { status: 400 })
    }

    // Try config API Key first, fallback to individual keys or ENV keys
    const apiKey = config?.apiKey || 
                   config?.geminiFreeApiKey || 
                   config?.geminiPaidApiKey || 
                   process.env.GEMINI_API_KEY || 
                   process.env.DEEPSEEK_API_KEY || 
                   process.env.OPENAI_API_KEY || 
                   process.env.ANTHROPIC_API_KEY
                   
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu API Key để tra từ điển. Vui lòng cấu hình ở tab Cài đặt API.' }, { status: 400 })
    }

    const provider = config?.provider || 'gemini'
    let ipa = ''
    let meaning = ''

    if (provider === 'gemini') {
      const { GoogleGenAI } = await import('@google/genai')
      const ai = new GoogleGenAI({ apiKey })
      const targetModel = config?.model || 'gemini-2.5-flash'

      const responseSchema = {
        type: 'OBJECT',
        properties: {
          word: { type: 'STRING' },
          ipa: { type: 'STRING' },
          meaning: { type: 'STRING' }
        },
        required: ['word', 'ipa', 'meaning']
      }

      const prompt = `Bạn là một từ điển Anh - Việt chuyên nghiệp. Hãy cung cấp phiên âm quốc tế IPA chính xác nhất và nghĩa tiếng Việt ngắn gọn, xúc tích nhất cho từ vựng sau đây: "${word}".`

      const res = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        }
      })

      const raw = res.text || '{}'
      const parsed = JSON.parse(raw)
      ipa = parsed.ipa || ''
      meaning = parsed.meaning || ''
    } else {
      const { OpenAI } = await import('openai')
      const client = new OpenAI({
        apiKey,
        baseURL: provider === 'deepseek' ? 'https://api.deepseek.com' : undefined,
      })
      
      let resolvedModel = config?.model
      if (!resolvedModel) {
        resolvedModel = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'
      } else if (provider === 'deepseek' && resolvedModel === 'deepseek-v4-flash') {
        resolvedModel = 'deepseek-chat'
      }

      const prompt = `Hãy cung cấp phiên âm quốc tế IPA và nghĩa tiếng Việt ngắn gọn nhất dưới dạng JSON cho từ vựng sau: "${word}". format: {"word": "${word}", "ipa": "/.../", "meaning": "..."}`
      const response = await client.chat.completions.create({
        model: resolvedModel,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      })

      const parsed = JSON.parse(response.choices[0].message.content || '{}')
      ipa = parsed.ipa || ''
      meaning = parsed.meaning || ''
    }

    return NextResponse.json({ word, ipa, meaning })
  } catch (err: any) {
    console.error('Lỗi tra từ điển:', err)
    return NextResponse.json({ error: err.message || 'Lỗi tra từ điển' }, { status: 500 })
  }
}
