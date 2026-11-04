---
frameworks:
- Pytorch
license: Apache License 2.0
tasks:
- text-to-speech

#model-type:
##如 gpt、phi、llama、chatglm、baichuan 等
#- gpt

#domain:
##如 nlp、cv、audio、multi-modal
#- nlp

#language:
##语言代码列表 https://help.aliyun.com/document_detail/215387.html?spm=a2c4g.11186623.0.0.9f8d7467kni6Aa
#- cn 

#metrics:
##如 CIDEr、Blue、ROUGE 等
#- CIDEr

#tags:
##各种自定义，包括 pretrained、fine-tuned、instruction-tuned、RL-tuned 等训练方法和其他
#- pretrained

#tools:
##如 vllm、fastchat、llamacpp、AdaSeq 等
#- vllm
---
### 使用 https://modelscope.cn/models/dengcunqin/matcha_tts_zh_en 权重进行微调。声音修改为温柔女声。
### 设置同原来的模型，所以使用方法同前。V1版本pt已上传（4090微调1小时，效果已可接受，英文效果稍差待解决），V2版本（更长时间的微调）待训练。
### 暂无空闲GPU训练，V2版本训练时间待确认。
### CPU即可推理，速度极快。
### 在线体验 https://www.tulingyun.com/tts.html 语音模型选温柔女声。
### 微信交流
Funasr群找小邓
WX号game_for_enjoy

### 微信小程序
<img src="https://www.modelscope.cn/models/dengcunqin/speech_seaco_paraformer_large_asr_nat-zh-cantonese-en-16k-common-vocab11666-pytorch/resolve/master/%E5%BE%AE%E4%BF%A1%E5%B0%8F%E7%A8%8B%E5%BA%8F%E7%A0%81.jpg" alt="微信小程序"  width="500" />

