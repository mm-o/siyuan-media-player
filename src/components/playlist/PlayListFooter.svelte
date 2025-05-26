<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { showMessage } from "siyuan";

    // 组件属性
    export let i18n: any;
    
    // 组件状态
    let inputValue = '';
    
    // 事件分发器
    const dispatch = createEventDispatcher<{
        addMedia: { url: string; options?: { autoPlay?: boolean; fromFileSelector?: boolean } };
    }>();
    
    // 处理提交
    function handleSubmit() {
        const url = inputValue.trim();
        if (!url) {
            // 当输入框为空时，打开文件选择器
            openFileSelector();
            return;
        }
        
        // 检查是否为本地文件路径但不是file://开头
        if ((url.includes(':\\') || (url.includes('/') && !url.startsWith('http') && !url.startsWith('file://'))) && !url.includes('bilibili.com')) {
            showMessage(i18n.playList.error.useAddButtonForLocalFiles || "要添加本地文件，请清空输入框并直接点击添加按钮");
            return;
        }
        
        // 检查是否为不支持的链接格式
        if (!url.startsWith('http://') && !url.startsWith('https://') 
            && !url.startsWith('file://')
            && !url.includes('bilibili.com') && !url.includes('b23.tv')) {
            showMessage(i18n.playList.error.invalidMediaLink || "不支持的媒体链接格式");
            return;
        }
        
        // 有URL时，添加链接
        dispatch('addMedia', { url, options: { autoPlay: false } });
        inputValue = '';
    }
    
    // 处理键盘事件
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    }
    
    // 打开文件选择器
    function openFileSelector() {
        const isElectron = () => window.navigator.userAgent.includes('Electron');
        
        if (!isElectron()) {
            showMessage(i18n.playList.error.electronOnly || "添加本地文件仅在桌面应用中支持");
            return;
        }
        
        try {
            const getDialog = () => window.require('@electron/remote').dialog;
            getDialog().showOpenDialog({
                properties: ['openFile', 'multiSelections'],
                filters: [{
                    name: i18n.playList.dialog.mediaFiles || "媒体文件", 
                    extensions: ['mp3','wav','ogg','m4a','flac','mp4','webm','mkv','avi','mov']
                }]
            }).then(result => {
                if (result.canceled || !result.filePaths.length) return;
                
                let count = 0;
                result.filePaths.forEach(path => {
                    const filePath = `file://${path.replace(/\\/g, '/')}`;
                    dispatch('addMedia', { url: filePath, options: { autoPlay: false, fromFileSelector: true } });
                    count++;
                });
                
                if (count > 0) {
                    showMessage(
                        (i18n.playList.message.filesAdded || "已添加${count}个媒体文件")
                        .replace('${count}', count.toString())
                    );
                }
            });
        } catch (error) {
            console.error("选择文件失败:", error);
            showMessage(i18n.playList.error.selectMediaFilesFailed || "选择媒体文件失败");
        }
    }
</script>

<div class="playlist-footer">
    <input 
        type="text" 
        class="tab-input playlist-input" 
        placeholder={i18n.playList.placeholder.mediaLink}
        bind:value={inputValue}
        on:keydown={handleKeydown}
    />
    {#if inputValue}
        <span class="clear-icon" on:click={() => inputValue = ''}>×</span>
    {/if}
    <button 
        class="add-btn" 
        on:click={handleSubmit}
    >
        {i18n.playList.action.add}
    </button>
</div>