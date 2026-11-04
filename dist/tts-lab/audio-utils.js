export function encodeWav(parts,sampleRate=16000){
  if(!parts.length||!Number.isInteger(sampleRate)||sampleRate<=0)throw Error('No audio to save.');
  const length=parts.reduce((n,part)=>n+part.length,0),bytes=new ArrayBuffer(44+length*2),view=new DataView(bytes);
  const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
  let offset=44;
  for(const part of parts)for(const sample of part){if(!Number.isFinite(sample))throw Error('The voice produced invalid audio.');view.setInt16(offset,Math.round(Math.max(-1,Math.min(1,sample))*32767),true);offset+=2;}
  return bytes;
}
export function validateText(text){
  const value=text.trim();if(!value)throw Error('Enter some Chinese text first.');if(value.length>400)throw Error('Keep this trial to 400 characters or fewer.');return value;
}
