<script lang="ts">
    import { createEventDispatcher } from "svelte";

    // 组件属性
    export let i18n: any;
    
    // 组件状态
    let inputValue = '';
    
    // 事件分发器
    const dispatch = createEventDispatcher<{
        addMedia: { url: string };
    }>();
    
    /**
     * 处理提交
     */
    function handleSubmit() {
        const url = inputValue.trim();
        if (!url) {
            return;
        }
        
        // 分发添加媒体事件
        dispatch('addMedia', { url });
        
        // 清空输入框
        inputValue = '';
    }
    
    /**
     * 处理键盘事件
     */
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    }
    
    /**
     * 清除输入框
     */
    function clearInput() {
        inputValue = '';
    }
</script>

<div class="playlist-footer">
    <div class="input-wrapper">
        <input 
            type="text" 
            class="tab-input playlist-input" 
            placeholder={i18n.playList.placeholder.mediaLink}
            bind:value={inputValue}
            on:keydown={handleKeydown}
        />
        {#if inputValue}
            <span class="clear-icon" on:click={clearInput}>×</span>
        {/if}
    </div>
    <button 
        class="add-btn" 
        on:click={handleSubmit}
        disabled={!inputValue.trim()}
    >
        {i18n.playList.action.add}
    </button>
</div> 