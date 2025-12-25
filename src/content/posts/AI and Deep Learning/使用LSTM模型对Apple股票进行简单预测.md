---
title: 使用LSTM模型对Apple股票进行简单预测
published: 2024-06-17
description: "一、技术基础 1.RNN RNN，即循环神经网络（Recurrent Neural Network），是一种专为处理序列数据而设计的神经网络架构。与传统的前馈神经网络不同，RNN具有循环的内部状态，能够在处理序列中的每个元素时保留和更新关于过去信息的记忆。这种机制使得RNN能够捕捉到数据中的时间依赖"
image: ""
tags: []
category: 深度学习
draft: false
---

# 一、技术基础

## 1.RNN

RNN，即循环神经网络（Recurrent Neural Network），是一种专为处理序列数据而设计的神经网络架构。与传统的前馈神经网络不同，RNN具有循环的内部状态，能够在处理序列中的每个元素时保留和更新关于过去信息的记忆。这种机制使得RNN能够捕捉到数据中的时间依赖性和顺序性，非常适合诸如自然语言处理（NLP）、语音识别、音乐生成、时间序列预测等任务。RNN的核心特性在于其循环单元，这个单元会在每个时间步（time step）对输入数据和前一时间步的隐藏状态进行处理，产生新的隐藏状态，然后将这个新状态传递到下一个时间步，形成一个信息流的循环。这个过程可以形象地描述为网络拥有“短期记忆”，能够在一定程度上模拟人类对序列数据处理时的“记忆”功能。

我们可以这样理解：想象一下你正在和一个非常聪明但有点健忘的朋友聊天，他能根据你刚刚说的话回应你，但很快就会忘记早些时候的对话内容。循环神经网络（RNN）就像是那个朋友，但它有一个小本子可以记笔记。在RNN中，这个“小本子”就是隐藏状态，它会在每次聊天（或者说，每个时间点）时更新。每当有新的话（新的输入数据）进来，RNN不仅会看这个新信息，还会参考它之前的“笔记”（前一时间步的隐藏状态），然后决定怎么更新它的“笔记”，以及如何回应你（产生输出）。这样，即使聊了很多内容，RNN也能基于整个对话的上下文给出合理的回答，因为它一直在用这个“小本子”记录重要的信息。

所以简单来说，RNN是一种特别擅长处理像句子这样有顺序信息的任务的AI模型，它能记住并利用过去的信息来帮助理解现在，就像你在阅读时会根据前面的句子理解当前句子的意思一样。

## 2.LSTM模型

LSTM 是一种特殊的循环神经网络 (RNN)，设计用于处理序列数据，如时间序列、自然语言文本等。传统的RNN在处理长序列时容易出现梯度消失或爆炸问题，而LSTM通过引入门控机制（输入门、遗忘门、输出门）来控制信息的流入、保存和流出，允许网络有选择地记住或忘记信息，算是RNN的有效改良。

简单理解：LSTM就是RNN Plus，它不仅拥有一个记事本，还有精细的控制按钮来决定哪些事情该牢牢记住，哪些可以适时忘记。在LSTM中，这个“记事本”被称为细胞状态，它能够存储长时间序列中的重要信息。不同于一般的记事本，LSTM给这个记事本配备了三个智能“控制门”：

1. **遗忘门**：决定哪些旧信息不再重要，可以擦除。就像翻看旧笔记时，有意识地划掉已经不相关的内容。
2. **输入门**：控制哪些新信息值得加入到记事本中。就像在笔记本上挑选精华部分仔细记录下来。
3. **输出门**：决定哪些存储的信息现在应该拿出来用，用于生成当前时刻的输出。好比根据当前谈话内容，选择性地分享之前记得的事情。

这样，LSTM能够非常聪明地管理信息流，既不会因为记住太多杂乱信息而混乱，也不会轻易忘记关键细节，特别适合处理那些需要长时间依赖关系的任务，比如语言翻译、情感分析或复杂的时序预测。正是因为LSTM模型在时间序列预测中表现良好，而股价数据就是典型的时间序列数据（过去价格变动的信息可能对预测未来股价有帮助），所以我们在此将LSTM模型运用到量化之中。

# 二、完整代码

```python
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
import matplotlib.pyplot as plt
import os
import tensorflow as tf

# 设置使用MPS加速
physical_devices = tf.config.list_physical_devices('GPU')
if physical_devices:
    try:
        tf.config.experimental.set_memory_growth(physical_devices[0], True)
    except:
        # 无法设置内存增长，忽略
        pass
    tf.config.set_visible_devices(physical_devices[0], 'GPU')

# 定义数据文件路径
data_file = 'AAPL_data.csv'

# 下载或读取股票历史数据
if os.path.exists(data_file):
    data = pd.read_csv(data_file, index_col='Date', parse_dates=True)
else:
    data = yf.download('AAPL', start='2010-01-01', end='2022-01-01')
    data.to_csv(data_file)

data = data[['Close']]

# 数据预处理
scaler = MinMaxScaler(feature_range=(0, 1))
scaled_data = scaler.fit_transform(data)

# 创建数据集
train_size = int(len(scaled_data) * 0.8)
train_data = scaled_data[:train_size]
test_data = scaled_data[train_size:]

def create_dataset(data, time_step=1):
    X, Y = [], []
    for i in range(len(data) - time_step - 1):
        X.append(data[i:(i + time_step), 0])
        Y.append(data[i + time_step, 0])
    return np.array(X), np.array(Y)

time_step = 60
X_train, y_train = create_dataset(train_data, time_step)
X_test, y_test = create_dataset(test_data, time_step)

# 调整输入数据形状为 [samples, time_steps, features]
X_train = X_train.reshape(X_train.shape[0], X_train.shape[1], 1)
X_test = X_test.reshape(X_test.shape[0], X_test.shape[1], 1)

# 构建LSTM模型
model = Sequential()
model.add(LSTM(50, return_sequences=True, input_shape=(time_step, 1)))
model.add(LSTM(50, return_sequences=False))
model.add(Dropout(0.3))
model.add(Dense(25))
model.add(Dense(1))

# 编译模型
model.compile(optimizer='adam', loss='mean_squared_error')

# 训练模型
model.fit(X_train, y_train, batch_size=64, epochs=20)

# 预测
train_predict = model.predict(X_train)
test_predict = model.predict(X_test)

# 反归一化
train_predict = scaler.inverse_transform(train_predict)
test_predict = scaler.inverse_transform(test_predict)

# 创建空数组以存储预测结果，并调整它们的位置
train_plot = np.empty_like(scaled_data)
train_plot[:, :] = np.nan
train_plot[time_step:len(train_predict) + time_step, :] = train_predict

test_plot = np.empty_like(scaled_data)
test_plot[:, :] = np.nan
test_plot[len(train_predict) + (time_step * 2) + 1:len(scaled_data) - 1, :] = test_predict

# 绘制结果
plt.figure(figsize=(14, 5))
plt.plot(data.index, scaler.inverse_transform(scaled_data)[:,0], label='Actual Prices')
plt.plot(data.index, train_plot[:,0], label='Train Predict')
plt.plot(data.index, test_plot[:,0], label='Test Predict')
plt.legend()
plt.show()

```

# 三、代码分析

## 1.导入所需库

```python
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
import matplotlib.pyplot as plt
import os
import tensorflow as tf
```

* numpy主要用于数学运算
* pandas则是数据分析的老朋友了，可以用来读取、处理数据集
* yifinance 是雅虎财经数据的api库，用来获取股票价格、期权、指数等金融数据
* sklearn.preprocessing.MinMaxScaler: 这是Scikit-Learn库中的一个预处理模块，用于数据的标准化。MinMaxScaler将数据缩放到[0, 1]区间内，有利于神经网络的训练
* tensorflow.keras.models.Sequential: Keras是TensorFlow的一个高级API，用于快速构建和训练深度学习模型。Sequential模型是Keras中的一种线性堆叠模型，用于创建具有顺序层的神经网络
* **tensorflow.keras.layers.LSTM, Dense, Dropout**:
  * **LSTM**: 长短期记忆层，专门用于处理时间序列数据，是循环神经网络的一种变体，能有效学习长期依赖关系。
  * **Dense**: 全连接层，用于网络中各神经元的全面连接，常用于网络的最后一层进行最终输出。
  * **Dropout**: 正则化技术，随机关闭网络中的一些神经元以防止过拟合，提高模型的泛化能力。
* **matplotlib.pyplot (plt)**: Matplotlib是Python中最常用的绘图库，pyplot是其面向对象接口，用于绘制静态、动态、交互式的图形。在股价预测中，常用于绘制实际股价与预测股价的对比图
* **os**: 操作系统接口模块，提供了许多与操作系统交互的功能，如文件和目录操作。在这个项目中，可能用于检查或创建文件路径等

## 2.设置TensorFlow使用GPU

```python
physical_devices = tf.config.list_physical_devices('GPU')
if physical_devices:
    try:
        tf.config.experimental.set_memory_growth(physical_devices[0], True)
    except:
        pass
    tf.config.set_visible_devices(physical_devices[0], 'GPU')
```

检查系统是否有可用的GPU，并尝试设置内存增长以提高训练效率

## 3.下载/读取AAPL股票历史数据

```python
data_file = 'AAPL_data.csv'
if os.path.exists(data_file):
    data = pd.read_csv(data_file, index_col='Date', parse_dates=True)
else:
    data = yf.download('AAPL', start='2010-01-01', end='2022-01-01')
    data.to_csv(data_file)
data = data[['Close']]
```

检查本地是否有数据文件，如果没有则从Yahoo Finance下载AAPL的历史数据，并保存为CSV文件

## 4.数据预处理

```python
scaler = MinMaxScaler(feature_range=(0, 1))
scaled_data = scaler.fit_transform(data)
```

使用MinMaxScaler将数据缩放到0到1之间（归一化处理）

在代码中使用 `MinMaxScaler`进行数据预处理，并将特征范围设定为(0, 1)，这是非常常见的做法，尤其是在准备数据用于机器学习和深度学习模型训练时。以下是这么做的几个主要原因：

1. **归一化**：通过缩放，将所有特征的值映射到0到1之间，这个过程称为归一化或标准化。这样做可以确保所有的输入特征都在同一尺度上，避免了因某些特征原始数值范围过大或过小而主导模型学习过程的问题。
2. **提升模型性能**：大多数机器学习算法（包括神经网络）在特征尺度统一时表现更好。归一化可以加快模型收敛速度，因为梯度下降等优化算法在特征尺度相近时更容易找到最优解。
3. **减轻权重不均衡问题**：在未标准化的数据上训练模型，特别是使用像梯度下降这样的优化算法时，可能会导致权重更新时偏向于大数值特征，而忽视小数值特征。归一化有助于平衡各特征的重要性。
4. **简化学习率选择**：归一化后，选择合适的 learning rate 变得更加直接，因为特征值都被约束在了一个合理的范围内。
5. **数值稳定性**：某些算法或激活函数（如sigmoid）在处理极端数值时可能会遇到梯度消失或爆炸的问题，归一化数据可以减少这类问题的发生。

`scaler.fit_transform(data)`首先通过 `fit`方法计算数据的最大值和最小值，然后通过 `transform`方法基于这些统计量将原始数据转换到0到1的范围内。这样一来，`scaled_data`就变成了适合用于训练模型的格式。

## 5.创建训练和测试数据集

```python
train_size = int(len(scaled_data) * 0.8)
train_data = scaled_data[:train_size]
test_data = scaled_data[train_size:]
```

将数据集按80%和20%的比例分为训练集和测试集

然后定义创建数据集的函数：

```python
def create_dataset(data, time_step=1):
    X, Y = [], []
    for i in range(len(data) - time_step - 1):
        X.append(data[i:(i + time_step), 0])
        Y.append(data[i + time_step, 0])
    return np.array(X), np.array(Y)
```

* 函数签名：`def create_dataset(data, time_step=1):`
  * `data`: 是一个二维数组（通常是从DataFrame转换而来），其中每一行代表一个时间点的观测值，本例中主要关注第一列（索引为0）的数据，即假设我们只用一个特征（如股价）进行预测。
  * `time_step=1`: 表示用于预测未来值的时间窗口大小，默认为1，意味着考虑前一个时间点的数据来预测下一个时间点的值。可以根据需求调整此参数来考虑更长的历史序列。
* 函数体：
  * `X, Y = [], []` 初始化两个空列表，`X`用于存放输入数据（特征），`Y`用于存放目标变量（标签），也就是我们要预测的值
  * f `or i in range(len(data) - time_step - 1):` 遍历原始数据集的索引，但不包括最后一个时间点以及不足以构成一个完整时间窗口的点
  * 在每次循环中，从 `data`中提取一个长度为 `time_step`的时间窗口数据，将其添加到 `X`列表中作为训练样本的输入特征。同时，将该时间窗口之后的一个时间点的数据（即 `data[i + time_step, 0]`）添加到 `Y`列表中作为对应的标签或目标值。
    ```
    X.append(data[i:(i + time_step), 0])
    Y.append(data[i + time_step, 0])

    ```
* 返回值：`return np.array(X), np.array(Y)` 最后，将列表 `X`和 `Y`转换为NumPy数组并返回。这样得到的 `X`是形状为 `(样本数, 时间窗口大小)`的数组，而 `Y`是形状为 `(样本数,)`的一维数组，分别对应模型训练所需的输入特征和输出标签。

这个函数将数据集转换为适合LSTM模型输入的格式，作用是从连续的时间序列数据中生成一系列的输入-输出对，每个输入是一个固定长度的历史数据窗口，输出是紧随该窗口之后的单个数据点

## 6.生成训练和测试数据集

```python
time_step = 60
X_train, y_train = create_dataset(train_data, time_step)
X_test, y_test = create_dataset(test_data, time_step)
X_train = X_train.reshape(X_train.shape[0], X_train.shape[1], 1)
X_test = X_test.reshape(X_test.shape[0], X_test.shape[1], 1)
```

将数据集转换为形状为 [samples, time\_steps, features] 的格式。

* **设置时间窗口大小 (`time_step`=60)**: 这里设置 `time_step`参数为60，意味着在构造数据集时，会使用过去60个时间点的数据来预测第61个时间点的值。这对于捕捉数据中的长期依赖关系特别有用，比如在金融市场预测、天气预报等领域。
* **创建训练集 (`X_train`, `y_train`)**: 调用 `create_dataset`函数，传入训练数据 `train_data`和时间窗口大小 `time_step=60`，生成训练集的特征 `X_train`和目标变量 `y_train`。`X_train`包含多个长度为60的时间序列窗口，`y_train`则包含这些窗口之后对应的单一目标值。
* **创建测试集 (`X_test`, `y_test`)**: 同样地，使用测试数据 `test_data`和相同的时间窗口大小 `time_step=60`来生成测试集的特征 `X_test`和目标变量 `y_test`。这用于评估模型在未见过的数据上的表现。
* **数据重塑**: 由于LSTM等循环神经网络通常要求输入数据具有特定的形状——`(样本数量, 时间步长, 特征数量)`，这里的特征数量为1（因为我们只关注一个变量）。因此，执行以下重塑操作：
  * `X_train = X_train.reshape(X_train.shape[0], X_train.shape[1], 1)`
  * `X_test = X_test.reshape(X_test.shape[0], X_test.shape[1], 1)`
  * 这两行代码将原本为二维的 `X_train`和 `X_test`（形状分别为 `(样本数, 时间窗口大小)`）重塑为三维数组，增加了特征维度，使之成为 `(样本数, 时间窗口大小, 1)`，符合大多数基于时间序列的深度学习模型的输入要求。这样，每个样本就明确地表示了时间序列的一个窗口，且指明了该窗口含有单个特征。

## 7.构建与训练LSTM模型

```python
model = Sequential()
model.add(LSTM(50, return_sequences=True, input_shape=(time_step, 1)))
model.add(LSTM(50, return_sequences=False))
model.add(Dropout(0.3))
model.add(Dense(25))
model.add(Dense(1))
model.compile(optimizer='adam', loss='mean_squared_error')
```

使用Sequential搭建LSTM网络，包括两层LSTM层和两层全连接层。

* `model = Sequential()`：初始化一个空的Sequential模型。Sequential模型是一个线性堆叠的网络，其中每一层都有唯一一个输入和输出。
* `model.add(LSTM(50, return_sequences=True, input_shape=(time_step, 1)))`：向模型中添加第一个LSTM（长短时记忆）层。LSTM是一种特殊的循环神经网络（RNN），特别适合于处理序列数据，能够学习长期依赖关系。
  * `50` 表示这一层LSTM单元的数量，即输出维度。
  * `return_sequences=True` 表示这一层的输出会作为下一个RNN层的输入，所以它会返回整个序列的输出。
  * `input_shape=(time_step, 1)` 指定了模型的输入形状，其中 `time_step`是输入序列的时间步长，`1`表示每个时间步的特征数量。例如，在处理单变量时间序列数据时，`1`可能代表一个单独的数据点。
* `model.add(LSTM(50, return_sequences=False))`：添加第二个LSTM层。与第一层不同的是，这里 `return_sequences=False`，意味着这层LSTM只返回序列的最后一个时间步的输出，而不是整个序列的输出，通常用于将序列信息压缩为一个固定长度的向量，以供后续全连接层使用。
* `model.add(Dropout(0.3))`：添加Dropout层，这是一种正则化技术，随机“丢弃”（设置为0）输入神经元的比例为0.3，以防止过拟合。这有助于模型泛化能力的提升。
* `model.add(Dense(25))`：添加一个全连接（Dense）层，拥有25个神经元。这层将前面LSTM层的输出作为输入，并进行进一步的学习和特征提取。
* `model.add(Dense(1))`：最后添加另一个全连接层，仅有一个神经元。对于回归问题（比如预测一个连续值），这是很常见的配置，输出单一预测值。
* `model.compile(optimizer='adam', loss='mean_squared_error')`：编译模型，指定优化器为Adam（一种常用的高效优化算法），损失函数为均方误差（Mean Squared Error, MSE）。MSE常用于回归问题，衡量预测值与真实值之间的差距。

使用Sequential搭建LSTM网络，包括两层LSTM层和两层全连接层。

开始训练：

```python
model.fit(X_train, y_train, batch_size=64, epochs=20)
```

* `model.fit(X_train, y_train, ...)`：这是开始模型训练的命令。`fit`函数用于通过输入数据 (`X_train`) 和目标数据 (`y_train`) 来训练模型。`X_train` 是训练集中的特征数据，而 `y_train` 是相应的目标或标签数据。
* `batch_size=64`：指定了每次迭代（一个前向传播和反向传播的过程）中使用的样本数。较大的批次大小可以加速训练过程，因为可以利用矩阵运算的高效性，但需要更多的内存。较小的批次则提供了更好的泛化能力，因为模型在每次更新时都会看到更多不同的数据子集。在这个例子中，选择了一个相对适中的批次大小64。
* `epochs=20`：表示整个训练数据集将被用来训练模型的完整遍历次数。一个epoch意味着所有训练样本都被模型学习过一次。增加epoch数量可以让模型更深入地学习数据，但也可能导致过拟合。在这里，模型将训练20次遍历数据集。

## 8.预测和反归一化

```python
train_predict = model.predict(X_train)
test_predict = model.predict(X_test)
train_predict = scaler.inverse_transform(train_predict)
test_predict = scaler.inverse_transform(test_predict)
```

**模型预测**:

* `train_predict = model.predict(X_train)`: 使用训练数据集 `X_train`对已经训练好的模型进行预测。这一步是为了评估模型在训练数据上的表现，虽然实际应用中更关注测试数据上的性能，但在调试和模型选择阶段，查看训练数据上的预测结果也很重要。
* `test_predict = model.predict(X_test)`: 接着，使用测试数据集 `X_test`进行预测。这是评估模型泛化能力的关键步骤，即看模型在未见过的数据上的表现如何。

**反归一化**:

* 在进行预测之前，如果原始数据进行了归一化处理（如使用MinMaxScaler或StandardScaler等），那么预测结果也需要通过相同的逆操作转换回原始尺度，以便结果具有实际意义。
* `train_predict = scaler.inverse_transform(train_predict)`: 这行代码对训练集的预测结果进行反归一化。`scaler`是之前用于对训练数据进行归一化的实例，`inverse_transform`方法将预测值转换回原始尺度。
* `test_predict = scaler.inverse_transform(test_predict)`: 同样，对测试集的预测结果也进行反归一化处理，以便我们能够直接理解和比较这些预测值与原始数据集中的实际目标值。

## 9.绘图

```python
train_plot = np.empty_like(scaled_data)
train_plot[:, :] = np.nan
train_plot[time_step:len(train_predict) + time_step, :] = train_predict
test_plot = np.empty_like(scaled_data)
test_plot[:, :] = np.nan
test_plot[len(train_predict) + (time_step * 2) + 1:len(scaled_data) - 1, :] = test_predict
plt.figure(figsize=(14, 5))
plt.plot(data.index, scaler.inverse_transform(scaled_data)[:,0], label='Actual Prices')
plt.plot(data.index, train_plot[:,0], label='Train Predict')
plt.plot(data.index, test_plot[:,0], label='Test Predict')
plt.legend()
plt.show()
```

**初始化绘图数组**:

* 首先创建两个与原始归一化数据形状相同的空数组 `train_plot`和 `test_plot`，并用 `np.nan`填充，这样做的目的是为了之后能在这两个数组中插入预测结果，同时保持时间序列的完整性。`np.empty_like(scaled_data)`确保新数组与原始数据在形状上一致。

**填充预测数据到绘图数组**:

* 对于 `train_plot`，从 `time_step`索引开始，用训练集的预测结果填充（考虑到LSTM模型可能需要一定的时间步作为输入来开始预测，因此从 `time_step`之后的位置开始填充）。这表示训练集预测是从原始数据序列的某一点开始覆盖的。
* 对于 `test_plot`，根据训练集预测的结束位置和测试集预测的起始位置计算，从训练预测结束后的某个时间点开始，用测试集的预测结果填充数组。注意，这里的偏移量考虑了 `time_step`和额外的间距，确保了预测结果在时间轴上的正确对齐。

**绘制图形**:

* 使用 `matplotlib`库绘制三条曲线：实际价格、训练集预测价格、测试集预测价格。
* `plt.figure(figsize=(14, 5))`设置图形大小。
* `plt.plot(data.index, scaler.inverse_transform(scaled_data)[:,0], label='Actual Prices')`绘制原始实际价格曲线，先对 `scaled_data`进行反归一化以得到实际价格，并用索引 `data.index`作为x轴，展示实际的价格变化。
* 分别绘制训练集和测试集的预测价格曲线，使用 `train_plot[:,0]`和 `test_plot[:,0]`作为y值，对应于预测的价格数据。
* `plt.legend()`显示图例，区分三条曲线。
* `plt.show()`展示图形。

# 三、总结

训练结果：

![Untitled](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202406170353363.png)

* 在训练时间内我重拳出击，预测未来我唯唯诺诺
* 毕竟选用的数据也只是简单的收盘价，太简单了
* 股票市场瞬息万变，是一个复杂的混沌模型，妄图简单的使用LSTM模型是不行的
