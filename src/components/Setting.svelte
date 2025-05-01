<!--
 Copyright (c) 2023 by frostime All Rights Reserved.
 Author       : frostime
 Date         : 2023-07-01 19:23:50
 FilePath     : /src/libs/components/setting-panel.svelte
 LastEditTime : 2024-08-09 21:41:07
 Description  : 
-->
<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { showMessage } from "siyuan";
    import type { ConfigManager } from "../core/config";
    import type { ISettingItem } from "../core/types";
    import { BilibiliParser } from "../core/bilibili";
    import { AListManager, type AListConfig } from "../core/alist";

    export let group: string;
    export let configManager: ConfigManager;
    export let i18n: any;
    
    // 状态管理
    let activeTab = 'account';
    let qrcodeData = '', qrcodeKey = '', checkQRCodeTimer: number;
    let loginSuccess = false, userInfo = null, scanStatus = i18n.setting.bilibili.waitingScan;
    let linkFormat = "- [😄标题 时间 艺术家 字幕](链接)";
    let showProPanel = false, proEnabled = false, showPaymentQRCodes = false;
    let playerPath = "PotPlayerMini64.exe";
    
    // AList配置
    let alistConfig: AListConfig = {
        server: "http://localhost:5244",
        username: "admin",
        password: "",
        connected: false
    };
    let alistConnected = false;
    
    // 标签页定义
    const tabs = [
        { id: 'account', name: i18n.setting.tabs?.account || '账号' },
        { id: 'player', name: i18n.setting.tabs?.player || '播放器' },
        { id: 'general', name: i18n.setting.tabs?.general || '通用' }
    ];
    
    // 基础设置项
    const defaultSettings: ISettingItem[] = [
        {
            key: "volume", value: 70, type: "slider",
            title: i18n.setting.items.volume.title,
            description: i18n.setting.items.volume.description,
            slider: { min: 0, max: 100, step: 1 }
        },
        {
            key: "speed", value: 100, type: "slider",
            title: i18n.setting.items.speed.title,
            description: i18n.setting.items.speed.description,
            slider: { min: 25, max: 200, step: 25 }
        },
        {
            key: "loopCount", value: 3, type: "slider",
            title: i18n.setting.items.loopCount.title,
            description: i18n.setting.items.loopCount.description,
            slider: { min: 1, max: 10, step: 1 }
        },
        {
            key: "insertAtCursor", value: true, type: "checkbox",
            title: i18n.setting.items.insertAtCursor.title,
            description: i18n.setting.items.insertAtCursor.description
        },
        {
            key: "showSubtitles", value: true, type: "checkbox",
            title: i18n.setting.items.showSubtitles?.title || "显示字幕",
            description: i18n.setting.items.showSubtitles?.description || "播放时显示字幕（如果有）"
        },
        {
            key: "enableDanmaku", value: false, type: "checkbox",
            title: i18n.setting.items.enableDanmaku?.title || "启用弹幕",
            description: i18n.setting.items.enableDanmaku?.description || "播放时启用弹幕（如果有）"
        },
        {
            key: "playerType", value: "built-in", type: "select",
            title: i18n.setting.items.playerType.title,
            description: i18n.setting.items.playerType.description,
            options: [
                { label: i18n.setting.items.playerType.builtIn, value: "built-in" },
                { label: i18n.setting.items.playerType.potPlayer, value: "potplayer" },
                { label: i18n.setting.items.playerType.browser, value: "browser" }
            ]
        }
    ];
    
    let settingItems = [...defaultSettings];
    const dispatch = createEventDispatcher();

    // 初始化
    onMount(() => {
        const loadConfig = async () => {
            const config = await configManager.load();
            settingItems = settingItems.map(item => ({
                ...item,
                value: config.settings[item.key] ?? item.value
            }));
            playerPath = config.settings.playerPath || "PotPlayerMini64.exe";
            linkFormat = config.settings.linkFormat || "- [😄标题 时间 艺术家 字幕](链接)";
            loginSuccess = !!config.bilibiliLogin;
            userInfo = config.bilibiliLogin?.userInfo;
            proEnabled = config.proEnabled || false;
            
            // 加载AList配置
            if (config.settings.alistConfig) {
                alistConfig = config.settings.alistConfig;
                alistConnected = !!alistConfig.connected;
                
                // 如果之前连接过，尝试重新连接
                if (alistConnected) {
                    testAListConnection();
                }
            }
        };
        loadConfig();
        
        return () => { if (checkQRCodeTimer) clearInterval(checkQRCodeTimer); };
    });

    // 二维码处理
    async function getBilibiliQRCode() {
        try {
            const qrInfo = await BilibiliParser.getLoginQRCode();
            qrcodeData = qrInfo.qrcodeData;
            qrcodeKey = qrInfo.qrcode_key;
            startQRCodeCheck();
        } catch (e) {
            showMessage(e.message || i18n.setting.bilibili.getQRCodeFailed);
        }
    }

    function startQRCodeCheck() {
        if (checkQRCodeTimer) clearInterval(checkQRCodeTimer);
        checkQRCodeTimer = window.setInterval(async () => {
            try {
                const status = await BilibiliParser.checkQRCodeStatus(qrcodeKey);
                switch (status.code) {
                    case 0:
                        clearInterval(checkQRCodeTimer);
                        scanStatus = i18n.setting.bilibili.loginSuccess;
                        await handleLoginSuccess(status);
                        break;
                    case 86038:
                        clearInterval(checkQRCodeTimer);
                        scanStatus = i18n.setting.bilibili.qrCodeExpired;
                        qrcodeData = '';
                        break;
                    case 86090:
                        scanStatus = i18n.setting.bilibili.qrCodeScanned;
                        break;
                    case 86101:
                        scanStatus = i18n.setting.bilibili.waitingScan;
                        break;
                    default:
                        scanStatus = status.message || i18n.setting.bilibili.unknownStatus;
                }
            } catch (e) {
                clearInterval(checkQRCodeTimer);
                showMessage(i18n.setting.bilibili.checkQRCodeFailed);
            }
        }, 3000);
    }

    // 账号管理
    async function handleLoginSuccess(status) {
        loginSuccess = true;
        userInfo = status.userInfo;
        const config = await configManager.getConfig();
        config.bilibiliLogin = {
            url: status.url,
            refresh_token: status.refresh_token,
            timestamp: status.timestamp,
            userInfo: status.userInfo
        };
        await configManager.save();
        showMessage(i18n.setting.bilibili.loginSuccess);
    }

    async function handleLogout() {
        loginSuccess = false;
        userInfo = null;
        const config = await configManager.getConfig();
        delete config.bilibiliLogin;
        await configManager.save();
        showMessage(i18n.setting.bilibili.logoutSuccess);
    }

    // 设置处理
    function handleChange(event, item) {
        const target = event.target;
        let value;
        if (target.type === 'checkbox') {
            value = target.checked;
        } else if (item.type === 'select') {
            value = target.value;
        } else {
            value = Number(target.value);
        }
        
        const index = settingItems.findIndex(i => i.key === item.key);
        if (index !== -1) {
            settingItems[index].value = value;
            settingItems = settingItems;
        }
    }

    async function saveSettings() {
        const settings = settingItems.reduce((acc, item) => ({
            ...acc,
            [item.key]: item.value
        }), {}) as any;
        
        settings.playerPath = playerPath;
        settings.linkFormat = linkFormat;
        
        // 保存AList设置
        if (alistConnected) {
            settings.alistConfig = alistConfig;
        }
        
        await configManager.updateSettings(settings);
        dispatch('changed', { settings });
        showMessage(i18n.setting.saveSuccess);
    }

    function resetSettings() {
        settingItems = defaultSettings.map(item => ({...item}));
        playerPath = "PotPlayerMini64.exe";
        linkFormat = "- [😄标题 时间 艺术家 字幕](链接)";
        
        // 重置AList配置
        alistConfig = {
            server: "http://localhost:5244",
            username: "admin",
            password: "",
            connected: false
        };
        alistConnected = false;
        
        const settings = settingItems.reduce((acc, item) => ({
            ...acc,
            [item.key]: item.value
        }), {}) as any;
        
        settings.playerPath = playerPath;
        settings.linkFormat = linkFormat;
        
        dispatch('changed', { settings });
        showMessage(i18n.setting.resetSuccess);
    }

    // AList功能
    async function testAListConnection() {
        try {
            const result = await AListManager.checkConnection(alistConfig);
            alistConnected = result.connected;
            
            if (result.connected) {
                // 立即更新设置
                const settings = await configManager.getConfig();
                settings.settings.alistConfig = alistConfig;
                await configManager.save();
                
                showMessage("AList连接成功");
            }
        } catch (error) {
            alistConnected = false;
        }
    }

    // Pro版功能
    async function handleProToggle(e) {
        proEnabled = e.target.checked;
        const config = await configManager.getConfig();
        config.proEnabled = proEnabled;
        await configManager.save();
        dispatch('changed', { proEnabled, settings: configManager.getConfig().settings });
        showMessage(proEnabled ? (i18n.pro?.activationSuccess || "Media Player Pro 已启用") : (i18n.pro?.activationDisabled || "Media Player Pro 已禁用"));
    }
</script>

<div class="settings common-panel" data-name={group}>
    <div class="settings-header">
        <h3>{i18n.setting.title}</h3>
        <div class="header-controls">
            <span>{tabs.find(tab => tab.id === activeTab)?.name || i18n.setting.description}</span>
        </div>
    </div>

    <div class="playlist-tabs">
        {#each tabs as tab}
            <button 
                class="tab" 
                class:active={activeTab === tab.id} 
                on:click={() => activeTab = tab.id}
            >
                {tab.name}
            </button>
        {/each}
    </div>

    <div class="setting-panel">
        <!-- 账号标签页 -->
        {#if activeTab === 'account'}
            <!-- Pro设置 -->
            <div class="setting-item pro-setting-item" on:click={() => showProPanel = !showProPanel}>
                <div class="setting-info">
                    <div class="setting-title pro-title">{i18n.pro?.title || "Media Player Pro"}</div>
                    <div class="setting-description">
                        {proEnabled ? (i18n.pro?.enabled || "已启用") : (i18n.pro?.disabled || "已禁用")} - {i18n.pro?.clickForDetails || "点击查看详情"}
                    </div>
                </div>
            </div>
            
            {#if showProPanel}
            <div class="setting-item pro-panel-content">
                <div class="setting-info">
                    {#if !proEnabled}
                    <div class="price-tag">
                        <div class="price-main">{i18n.pro?.priceTag || "¥ 18.00"}</div>
                        <div class="price-options">
                            <div>{@html i18n.pro?.priceWithStar || "或 ¥ 16.00 + GitHub Star 关注"}</div>
                        </div>
                    </div>
                    
                    <div class="setting-description">
                        {i18n.pro?.description || "若你喜欢Media Player，可以尝试为其付费哦～"}<br>
                        <button class="b3-button b3-button--primary fn__block" on:click={() => showPaymentQRCodes = !showPaymentQRCodes}>
                            {showPaymentQRCodes ? (i18n.pro?.hideQRCode || "隐藏付款码") : (i18n.pro?.showQRCode || "点击付款")}
                        </button>
                    </div>
                    
                    {#if showPaymentQRCodes}
                    <div class="payment-qrcodes">
                        <div class="qrcode-item">
                            <img src="/plugins/siyuan-media-player/assets/images/alipay.jpg" alt="支付宝付款码" />
                        </div>
                        <div class="qrcode-item">
                            <img src="/plugins/siyuan-media-player/assets/images/wechat.jpg" alt="微信付款码" />
                        </div>
                    </div>
                    {/if}
                    {/if}
                    
                    <div class="activation-toggle">
                        <div class="setting-info">
                            <div class="setting-title">{i18n.pro?.activationTitle || "我已诚信付款，启用Media Player Pro"}</div>
                        </div>
                        <div class="setting-control">
                            <label class="checkbox-wrapper">
                                <input type="checkbox" bind:checked={proEnabled} on:change={handleProToggle} />
                                <span class="checkbox-custom"></span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="feature-single">
                        <div class="feature-item">
                            <svg viewBox="0 0 1024 1024" class="feature-icon">
                                <path d="M510.4 220.8c-156.8 0-284.8 128-284.8 284.8s128 284.8 284.8 284.8 284.8-128 284.8-284.8-128-284.8-284.8-284.8z M510.4 705.6c-113.6 0-204.8-91.2-204.8-204.8 0-113.6 91.2-204.8 204.8-204.8s204.8 91.2 204.8 204.8c0 113.6-91.2 204.8-204.8 204.8zM633.6 820.8H388.8c-22.4 0-40 17.6-40 40s17.6 40 40 40h244.8c22.4 0 40-17.6 40-40s-17.6-40-40-40zM569.6 929.6h-118.4c-22.4 0-40 17.6-40 40s17.6 40 40 40h118.4c22.4 0 40-17.6 40-40s-17.6-40-40-40zM510.4 179.2c24 0 43.2-19.2 43.2-43.2V52.8c0-24-19.2-43.2-43.2-43.2s-43.2 19.2-43.2 43.2v83.2c0 22.4 19.2 43.2 43.2 43.2zM276.8 275.2c17.6-17.6 17.6-44.8 0-60.8l-59.2-59.2c-8-8-19.2-12.8-30.4-12.8s-22.4 4.8-30.4 12.8c-9.6 8-12.8 19.2-12.8 30.4s4.8 22.4 12.8 30.4l59.2 59.2c8 8 19.2 12.8 30.4 12.8s20.8-4.8 30.4-12.8zM864 155.2c-8-8-19.2-12.8-30.4-12.8s-22.4 4.8-30.4 12.8l-59.2 59.2c-17.6 17.6-17.6 44.8 0 60.8 8 8 19.2 12.8 30.4 12.8s22.4-4.8 30.4-12.8l59.2-59.2c17.6-16 17.6-43.2 0-60.8zM136 462.4H52.8c-24 0-43.2 19.2-43.2 43.2s19.2 43.2 43.2 43.2h83.2c24 0 43.2-19.2 43.2-43.2s-19.2-43.2-43.2-43.2zM968 462.4h-83.2c-24 0-43.2 19.2-43.2 43.2s19.2 43.2 43.2 43.2h83.2c24 0 43.2-19.2 43.2-43.2s-19.2-43.2-43.2-43.2z"/>
                            </svg>
                            <div class="feature-info">
                                <div class="feature-title pro-title">{i18n.pro?.features?.assistant?.title || "媒体助手"}</div>
                                <div class="setting-description">{i18n.pro?.features?.assistant?.description || "字幕列表、视频总结"}</div>
                            </div>
                        </div>
                        
                        <div class="feature-item">
                            <svg viewBox="0 0 1024 1024" class="feature-icon">
                                <path d="M414.47619 121.904762a73.142857 73.142857 0 0 1 73.142858 73.142857v219.428571a73.142857 73.142857 0 0 1-73.142858 73.142858H195.047619a73.142857 73.142857 0 0 1-73.142857-73.142858V195.047619a73.142857 73.142857 0 0 1 73.142857-73.142857h219.428571zM195.047619 195.047619v219.428571h219.428571V195.047619H195.047619z m219.428571 341.333333a73.142857 73.142857 0 0 1 73.142858 73.142858v219.428571a73.142857 73.142857 0 0 1-73.142858 73.142857H195.047619a73.142857 73.142857 0 0 1-73.142857-73.142857v-219.428571a73.142857 73.142857 0 0 1 73.142857-73.142858h219.428571z m-219.428571 73.142858v219.428571h219.428571v-219.428571H195.047619zM536.380952 182.857143v73.142857h353.52381v-73.142857H536.380952zM536.380952 609.52381v73.142857h353.52381v-73.142857H536.380952z m0-268.190477v73.142857h353.52381v-73.142857H536.380952z m0 426.666667v73.142857h353.52381v-73.142857H536.380952z"/>
                            </svg>
                            <div class="feature-info">
                                <div class="feature-title pro-title">{i18n.pro?.features?.tagExtension?.title || "标签拓展"}</div>
                                <div class="setting-description">{i18n.pro?.features?.tagExtension?.description || "本地文件夹、B站收藏夹、更多"}</div>
                            </div>
                        </div>
                        
                        <div class="feature-item">
                            <svg viewBox="0 0 1024 1024" class="feature-icon">
                                <path d="M448.487619 97.52381l130.096762 0.170666c40.399238 0.073143 73.142857 32.792381 73.191619 73.216l0.048762 21.211429a345.283048 345.283048 0 0 1 71.143619 39.960381l17.408-10.044953a73.313524 73.313524 0 0 1 99.961905 26.819048l65.219047 112.566857a73.313524 73.313524 0 0 1-22.893714 97.816381l-3.974095 2.438095-17.481143 10.093715a341.479619 341.479619 0 0 1-1.292191 83.968l12.361143 7.168a73.313524 73.313524 0 0 1 28.867048 96.329142l-2.023619 3.803429-61.098667 105.813333a73.313524 73.313524 0 0 1-96.329143 28.867048l-3.803428-2.048-16.896-9.752381a341.918476 341.918476 0 0 1-68.291048 38.083048l0.024381 29.062095a73.313524 73.313524 0 0 1-68.754286 73.264762l-4.632381 0.146285-130.121142-0.170666a73.313524 73.313524 0 0 1-73.191619-73.216l-0.048762-35.035429a346.599619 346.599619 0 0 1-57.368381-34.035809l-31.158857 17.944381a73.313524 73.313524 0 0 1-99.986286-26.819048l-65.219048-112.566857a73.313524 73.313524 0 0 1 22.918095-97.816381l3.949715-2.438095 31.719619-18.285715c-2.438095-23.161905-2.56-46.665143-0.219429-70.119619l-35.206095-20.333714a73.313524 73.313524 0 0 1-28.891429-96.329143l2.048-3.803428 61.098667-105.813334a73.313524 73.313524 0 0 1 96.329143-28.867047l3.803429 2.048 30.72 17.724952a341.284571 341.284571 0 0 1 64.609523-39.716571l-0.048762-27.89181a73.313524 73.313524 0 0 1 68.754286-73.264762L448.487619 97.52381z m-0.097524 73.313523l0.073143 74.48381-42.130286 19.846095c-18.041905 8.46019-35.05981 18.919619-50.761142 31.158857l-38.936381 30.403048-71.655619-41.398857-1.852953-1.024-61.074286 105.813333 76.239239 44.007619-4.729905 47.104a268.434286 268.434286 0 0 0 0.170666 55.100952l5.022477 47.445334-73.069715 42.081524 65.194667 112.566857 72.557714-41.740191 38.473143 28.184381a272.579048 272.579048 0 0 0 45.226667 26.819048l42.057143 19.772952 0.146285 81.529905 130.072381 0.170667-0.073143-78.019048 45.202286-18.822095a268.629333 268.629333 0 0 0 53.638095-29.915429l38.448762-27.648 57.904762 33.426286 61.049905-105.813333-55.100952-31.890286 6.826666-48.88381a268.190476 268.190476 0 0 0 1.024-65.950476l-5.12-47.494095 58.928762-34.011429-65.219047-112.566857L718.262857 319.390476l-38.497524-28.086857a272.62781 272.62781 0 0 0-56.051809-31.50019l-45.104762-18.724572-0.121905-70.070857-130.096762-0.170667z m145.895619 210.407619a146.773333 146.773333 0 0 1 53.686857 200.362667 146.407619 146.407619 0 0 1-200.167619 53.638095 146.773333 146.773333 0 0 1-53.662476-200.362666 146.407619 146.407619 0 0 1 200.167619-53.638096z m-136.655238 90.258286a73.48419 73.48419 0 0 0 26.86781 100.278857 73.118476 73.118476 0 0 0 99.961904-26.770285c19.529143-33.865143 9.020952-76.824381-23.186285-98.03581l-3.657143-2.267429-3.803429-2.048a73.118476 73.118476 0 0 0-96.182857 28.842667z"/>
                            </svg>
                            <div class="feature-info">
                                <div class="feature-title pro-title">{i18n.pro?.features?.comingSoon?.title || "待开发"}</div>
                                <div class="setting-description">{i18n.pro?.features?.comingSoon?.description || "功能开发中"}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/if}

            <!-- 哔哩哔哩账号 -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-title">{i18n.setting.bilibili.account}</div>
                    <div class="setting-content">
                    {#if loginSuccess && userInfo}
                        <div class="user-wrapper">
                            <img class="user-avatar" src={userInfo.face} alt={i18n.setting.bilibili.avatar} />
                            <div class="user-details">
                                <div class="user-name">
                                    {userInfo.uname}
                                    <span class="user-level">LV{userInfo.level_info.current_level}</span>
                                </div>
                                <div class="user-id">UID: {userInfo.mid}</div>
                            </div>
                        </div>
                    {:else}
                        <div class="setting-description">{i18n.setting.bilibili.loginDescription}</div>
                    {/if}
                    </div>
                </div>
                <div class="setting-control">
                    {#if !loginSuccess}
                    <button class="b3-button b3-button--outline" 
                        on:click={getBilibiliQRCode} 
                        disabled={!!qrcodeData}>
                        {i18n.setting.bilibili.login}
                    </button>
                    {:else}
                    <button class="b3-button b3-button--outline" on:click={handleLogout}>
                        {i18n.setting.bilibili.logout}
                    </button>
                    {/if}
                </div>
            </div>
            
            {#if qrcodeData && !loginSuccess}
            <div class="bilibili-qrcode">
                <div class="qrcode-header">
                    <div class="qrcode-title">{i18n.setting.bilibili.scanTitle}</div>
                    <div class="qrcode-description">{i18n.setting.bilibili.scanDescription}</div>
                </div>
                <div class="qrcode-container">
                    <img src={qrcodeData} alt={i18n.setting.bilibili.qrCode} />
                    <div class="scan-status" class:success={loginSuccess}>{scanStatus}</div>
                </div>
            </div>
            {/if}

            <!-- AList 配置部分 -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-title">AList 配置</div>
                    <div class="setting-description">设置AList服务器地址、用户名和密码，支持网盘文件播放</div>
                    <div class="setting-content">
                        <div class="alist-form">
                            <label>服务器地址</label>
                            <input type="text" class="b3-text-field fn__block" placeholder="http://localhost:5244" bind:value={alistConfig.server} />
                            
                            <label>用户名</label>
                            <input type="text" class="b3-text-field fn__block" placeholder="admin" bind:value={alistConfig.username} />
                            
                            <label>密码</label>
                            <input type="password" class="b3-text-field fn__block" placeholder="请输入密码" bind:value={alistConfig.password} />
                        </div>
                        
                        <div class="alist-status">
                            <span class="status-dot {alistConnected ? 'connected' : 'disconnected'}"></span>
                            <span>{alistConnected ? '已连接' : '未连接'}</span>
                            <button class="b3-button b3-button--outline" on:click={testAListConnection}>测试连接</button>
                        </div>
                    </div>
                </div>
            </div>
        {/if}

        <!-- 播放器标签页 -->
        {#if activeTab === 'player'}
            {#each settingItems.filter(item => ['volume', 'speed', 'playerType', 'showSubtitles', 'enableDanmaku'].includes(item.key)) as item (item.key)}
                <div class="setting-item" class:with-path={item.key === 'playerType' && item.value === 'potplayer'}>
                    <div class="setting-info">
                        <div class="setting-title">{item.title}</div>
                        {#if item.description}
                            <div class="setting-description">{item.description}</div>
                        {/if}
                        {#if item.type === 'slider'}
                            <div class="setting-content">
                                <div class="slider-wrapper">
                                    <input
                                        type="range"
                                        min={item.slider?.min ?? 0}
                                        max={item.slider?.max ?? 100}
                                        step={item.slider?.step ?? 1}
                                        value={item.value}
                                        on:input={(e) => handleChange(e, item)}
                                    />
                                    <span class="slider-value">
                                        {item.key === 'speed' ? Number(item.value) / 100 + 'x' : item.value}
                                    </span>
                                </div>
                            </div>
                        {/if}
                    </div>
                    <div class="setting-control">
                        {#if item.type === 'checkbox'}
                            <label class="checkbox-wrapper">
                                <input type="checkbox" checked={Boolean(item.value)} on:change={(e) => handleChange(e, item)} />
                                <span class="checkbox-custom"></span>
                            </label>
                        {:else if item.type === 'select'}
                            <select class="select-wrapper" value={item.value} on:change={(e) => handleChange(e, item)}>
                                {#each item.options || [] as option}
                                    <option value={option.value}>{option.label}</option>
                                {/each}
                            </select>
                        {/if}
                    </div>
                    
                    {#if item.key === 'playerType' && item.value === 'potplayer'}
                        <input type="text" class="player-path-input" bind:value={playerPath} placeholder={i18n.setting.items.playerPath.title} />
                    {/if}
                </div>
            {/each}
        {/if}

        <!-- 通用标签页 -->
        {#if activeTab === 'general'}
            {#each settingItems.filter(item => ['insertAtCursor', 'loopCount'].includes(item.key)) as item (item.key)}
                <div class="setting-item">
                    <div class="setting-info">
                        <div class="setting-title">{item.title}</div>
                        {#if item.description}
                            <div class="setting-description">{item.description}</div>
                        {/if}
                        {#if item.type === 'slider'}
                            <div class="setting-content">
                                <div class="slider-wrapper">
                                    <input
                                        type="range"
                                        min={item.slider?.min ?? 0}
                                        max={item.slider?.max ?? 100}
                                        step={item.slider?.step ?? 1}
                                        value={item.value}
                                        on:input={(e) => handleChange(e, item)}
                                    />
                                    <span class="slider-value">{item.value}</span>
                                </div>
                            </div>
                        {/if}
                    </div>
                    <div class="setting-control">
                        {#if item.type === 'checkbox'}
                            <label class="checkbox-wrapper">
                                <input type="checkbox" checked={Boolean(item.value)} on:change={(e) => handleChange(e, item)} />
                                <span class="checkbox-custom"></span>
                            </label>
                        {/if}
                    </div>
                </div>
            {/each}

            <!-- 链接格式设置 -->
            <div class="setting-item">
                <div class="setting-info">
                    <div class="setting-title">{i18n.setting.items?.linkFormat?.title || "链接格式"}</div>
                    <div class="setting-description">{i18n.setting.items?.linkFormat?.description}</div>
                    <div class="setting-content">
                        <input type="text" class="b3-text-field fn__block" bind:value={linkFormat} placeholder="- [😄标题 时间 艺术家 字幕](链接)" />
                    </div>
                </div>
            </div>
        {/if}
    </div>
    
    <!-- 底部操作区 -->
    <div class="playlist-footer">
        <button class="add-btn" on:click={resetSettings}>
            <svg class="icon"><use xlink:href="#iconRefresh"></use></svg>
            <span>{i18n.setting.reset}</span>
        </button>
        <button class="add-btn" on:click={saveSettings}>
            <svg class="icon"><use xlink:href="#iconCheck"></use></svg>
            <span>{i18n.setting.save}</span>
        </button>
    </div>
</div>