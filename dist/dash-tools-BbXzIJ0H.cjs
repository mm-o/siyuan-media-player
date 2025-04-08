"use strict";function p(i,d=null){return i!=null&&i.length?i.sort((h,a)=>{if(d){if(h.id===d)return-1;if(a.id===d)return 1}return a.id-h.id||a.bandwidth-h.bandwidth})[0]:null}function $(i){var m,g,c,f,l,u;if(!i.data.dash)throw new Error("无效的DASH数据");const d=i.data.dash.duration||Math.floor(i.data.timelength/1e3),r=d&&!isNaN(d)&&d>0?d:3600;let a=`<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
    xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd" 
    profiles="urn:mpeg:dash:profile:isoff-on-demand:2011"
    type="static" 
    minBufferTime="PT${i.data.dash.min_buffer_time||1.5}S" 
    mediaPresentationDuration="PT${r}S">
    <Period id="1" start="PT0S">`;if(((m=i.data.dash.video)==null?void 0:m.length)>0){const o=i.data.dash.video.filter(t=>t&&t.baseUrl&&t.id&&t.codecs&&t.bandwidth&&t.width&&t.height&&t.frameRate);if(o.length>0){const t=Math.max(...o.map(e=>e.width)),n=Math.max(...o.map(e=>e.height));a+=`
        <AdaptationSet 
            mimeType="video/mp4" 
            segmentAlignment="true" 
            startWithSAP="1"
            maxWidth="${t}"
            maxHeight="${n}">`;const s=[...o].sort((e,w)=>{const S=w.height-e.height;return S!==0?S:w.bandwidth-e.bandwidth});for(const e of s)a+=`
            <Representation 
                id="video-${e.id}" 
                codecs="${e.codecs}" 
                bandwidth="${e.bandwidth}" 
                width="${e.width}" 
                height="${e.height}" 
                frameRate="${e.frameRate}"
                scanType="progressive">
                <BaseURL>${e.baseUrl}</BaseURL>
                <SegmentBase indexRange="${((g=e.segment_base)==null?void 0:g.index_range)||"0-0"}">
                    <Initialization range="${((c=e.segment_base)==null?void 0:c.initialization)||"0-0"}"/>
                </SegmentBase>
            </Representation>`;a+=`
        </AdaptationSet>`}}if(((f=i.data.dash.audio)==null?void 0:f.length)>0){const o=i.data.dash.audio.filter(t=>t&&t.baseUrl&&t.codecs&&t.bandwidth);if(o.length>0){const t=[...o].sort((n,s)=>s.bandwidth-n.bandwidth);a+=`
        <AdaptationSet 
            mimeType="audio/mp4" 
            segmentAlignment="true" 
            startWithSAP="1"
            lang="und">`;for(const n of t){const s=n.id||Math.floor(Math.random()*1e3);a+=`
            <Representation 
                id="audio-${s}" 
                codecs="${n.codecs}" 
                bandwidth="${n.bandwidth}">
                <BaseURL>${n.baseUrl}</BaseURL>
                <SegmentBase indexRange="${((l=n.segment_base)==null?void 0:l.index_range)||"0-0"}">
                    <Initialization range="${((u=n.segment_base)==null?void 0:u.initialization)||"0-0"}"/>
                </SegmentBase>
            </Representation>`}a+=`
        </AdaptationSet>`}}return a+=`
    </Period>
</MPD>`,a}exports.generateMPD=$;exports.selectBestStream=p;
