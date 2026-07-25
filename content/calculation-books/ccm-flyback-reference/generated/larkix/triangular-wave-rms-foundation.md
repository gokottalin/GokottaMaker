> 推导层级：L3_foundation_derivation。父公式：$I_{prirms}$。

该式不是经验系数，而是线性斜坡在导通占比 D 内的平方积分结果。

## 前提与适用范围

- 前置知识：RMS 定义；线性插值；多项式定积分
- 假设：无额外工程假设
- 有效范围：电流在导通区间由 $I_{valley}$ 线性变化到 $I_{peak}$，关断区间为零。

## 逐步推导

### 1. 从整周期 RMS 定义出发。

$$
I_{rms²}=(1/T)∫₀ᵀ i²(t)dt
$$

RMS 是平方平均的平方根。

依据：RMS 定义。

### 2. 把导通区间归一化为 x∈[0,1] 的线性电流。

$$
i(x)=I_{valley}+(I_{peak}-I_{valley})x
$$

定电感、定电压下 di/dt 为常数。

依据：线性插值。

### 3. 对线性电流平方积分。

$$
∫₀¹i²(x)dx=(I_{valley²}+I_{valley}·I_{peak}+I_{peak²})/3
$$

展开二次多项式并逐项积分。

依据：多项式定积分。

### 4. 导通区间只占整周期 D。

$$
I_{prirms}=sqrt{D/3·(I_{valley²}+I_{valley}·I_{peak}+I_{peak²})}
$$

关断区间原边开关电流为零，平方积分只乘导通占比 D。

依据：分段积分合并。

## 量纲检查

括号内为 A²，D/3 为无量纲，平方根后为 A。

[返回上一级计算书](./derive.html?slug=ccm-flyback-current-chain-derivation)
