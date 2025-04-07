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

    export let group: string;
    export let configManager: ConfigManager;
    export let i18n: any;
    
    let qrcodeData: string = '';
    let qrcodeKey: string = '';
    let checkQRCodeTimer: number;
    let loginSuccess = false;
    let loginTimestamp: number | null = null;
    let userInfo: {
        face: string;
        level_info: {
            current_level: number;
        };
        mid: number;
        uname: string;
    } | null = null;
    let scanStatus: string = i18n.setting.bilibili.waitingScan;
    
    // 初始化时加载配置
    onMount(() => {
        return () => {
            // 组件卸载时清理定时器
            if (checkQRCodeTimer) {
                clearInterval(checkQRCodeTimer);
            }
        };
    });
    
    /**
     * 获取B站登录二维码
     */
    async function getBilibiliQRCode() {
        try {
            const qrInfo = await BilibiliParser.getLoginQRCode();
            qrcodeData = qrInfo.qrcodeData;
            qrcodeKey = qrInfo.qrcode_key;
            
            // 开始轮询检查扫码状态
            startQRCodeCheck();
        } catch (e) {
            showMessage(e.message || i18n.setting.bilibili.getQRCodeFailed);
        }
    }
    
    /**
     * 处理登录成功
     * @param status 登录状态信息
     */
    async function handleLoginSuccess(status: any) {
        loginSuccess = true;
        loginTimestamp = status.timestamp;
        userInfo = status.userInfo;
        
        // 保存登录信息到配置文件
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
    
    /**
     * 处理退出登录
     */
    async function handleLogout() {
        loginSuccess = false;
        loginTimestamp = null;
        userInfo = null;
        
        // 清除配置文件中的登录信息
        const config = await configManager.getConfig();
        delete config.bilibiliLogin;
        await configManager.save();
        
        showMessage(i18n.setting.bilibili.logoutSuccess);
    }
    
    /**
     * 开始检查二维码扫描状态
     */
    function startQRCodeCheck() {
        // 清理已有的定时器
        if (checkQRCodeTimer) {
            clearInterval(checkQRCodeTimer);
        }
        
        // 每3秒检查一次扫码状态
        checkQRCodeTimer = window.setInterval(async () => {
            try {
                const status = await BilibiliParser.checkQRCodeStatus(qrcodeKey);
                
                // 处理不同状态
                switch (status.code) {
                    case 0: // 登录成功
                        clearInterval(checkQRCodeTimer);
                        scanStatus = i18n.setting.bilibili.loginSuccess;
                        await handleLoginSuccess(status);
                        break;
                    case 86038: // 二维码已失效
                        clearInterval(checkQRCodeTimer);
                        scanStatus = i18n.setting.bilibili.qrCodeExpired;
                        qrcodeData = '';
                        break;
                    case 86090: // 二维码已扫描
                        scanStatus = i18n.setting.bilibili.qrCodeScanned;
                        break;
                    case 86101: // 未扫码
                        scanStatus = i18n.setting.bilibili.waitingScan;
                        // 继续等待扫码，不做处理
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
    
    // 初始设置项
    const defaultSettings: ISettingItem[] = [
        {
            key: "volume",
            value: 70,
            type: "slider",
            title: i18n.setting.items.volume.title,
            description: i18n.setting.items.volume.description,
            slider: {
                min: 0,
                max: 100,
                step: 1
            }
        },
        {
            key: "speed",
            value: 100,
            type: "slider",
            title: i18n.setting.items.speed.title,
            description: i18n.setting.items.speed.description,
            slider: {
                min: 25,
                max: 200,
                step: 25
            }
        },
        {
            key: "loopCount",
            value: 3,
            type: "slider",
            title: i18n.setting.items.loopCount.title,
            description: i18n.setting.items.loopCount.description,
            slider: {
                min: 1,
                max: 10,
                step: 1
            }
        },
        {
            key: "insertAtCursor",
            value: true,
            type: "checkbox",
            title: i18n.setting.items.insertAtCursor.title,
            description: i18n.setting.items.insertAtCursor.description
        }
    ];
    
    let settingItems = [...defaultSettings];
    
    // 组件加载时从配置加载设置
    onMount(async () => {
        const config = await configManager.load();
        
        // 更新设置项的值
        settingItems = settingItems.map(item => ({
            ...item,
            value: config.settings[item.key] ?? item.value
        }));

        // 加载 B 站账号信息
        if (config.bilibiliLogin) {
            loginSuccess = true;
            loginTimestamp = config.bilibiliLogin.timestamp;
            userInfo = config.bilibiliLogin.userInfo;
        }
    });
    
    const dispatch = createEventDispatcher();

    /**
     * 保存所有设置
     */
    async function saveSettings() {
        const settings = settingItems.reduce((acc, item) => ({
            ...acc,
            [item.key]: item.value
        }), {});
        
        await configManager.updateSettings(settings);
        dispatch('changed', { settings });
        showMessage(i18n.setting.saveSuccess);
    }
    
    /**
     * 重置所有设置
     */
    function resetSettings() {
        settingItems = defaultSettings.map(item => ({...item}));
        const settings = settingItems.reduce((acc, item) => ({
            ...acc,
            [item.key]: item.value
        }), {});
        dispatch('changed', { settings });
        showMessage(i18n.setting.resetSuccess);
    }

    /**
     * 处理设置项变更
     */
    function handleChange(event: Event, item: ISettingItem) {
        const target = event.target as HTMLInputElement | HTMLSelectElement;
        let value: number | boolean = target.type === 'checkbox' 
            ? (target as HTMLInputElement).checked 
            : Number(target.value);
        
        // 更新设置项的值
        const index = settingItems.findIndex(i => i.key === item.key);
        if (index !== -1) {
            settingItems[index].value = value;
            settingItems = settingItems;
        }
    }
</script>

<div class="settings" data-name={group}>
    <!-- Header -->
    <div class="settings-header">
        <h3>{i18n.setting.title}</h3>
        <div class="header-actions">
            <button class="btn" on:click={resetSettings}>
                <span>{i18n.setting.reset}</span>
            </button>
            <button class="btn primary" on:click={saveSettings}>
                <span>{i18n.setting.save}</span>
            </button>
        </div>
    </div>

    <div class="setting-panel">
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
                <div class="scan-status" class:success={loginSuccess}>
                    {scanStatus}
                </div>
            </div>
        </div>
        {/if}

        {#each settingItems as item (item.key)}
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
                                <span class="slider-value">
                                    {#if item.key === 'speed'}
                                        {item.value / 100}x
                                    {:else}
                                        {item.value}
                                    {/if}
                                </span>
                            </div>
                        </div>
                    {/if}
                </div>
                <div class="setting-control">
                    {#if item.type === 'checkbox'}
                        <label class="checkbox-wrapper">
                            <input
                                type="checkbox"
                                checked={item.value}
                                on:change={(e) => handleChange(e, item)}
                            />
                            <span class="checkbox-custom"></span>
                        </label>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>