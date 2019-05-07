import { observable, action, computed } from 'mobx'
import BigNumber from 'bignumber.js'
import Wallet from './Wallet'
import Keystore from '../../../../Libs/react-native-golden-keystore'
import api from '../../../api'
import MainStore from '../../MainStore'
import WalletTokenLTC from '../WalletToken.ltc'
import TransactionLTC from '../Transaction.ltc'
import GetAddress, { chainNames } from '../../../Utils/WalletAddresses'

const defaultObjWallet = {
  title: '',
  address: '',
  balance: '0',
  type: 'litecoin',
  path: Keystore.CoinType.LTC.path,
  external: false,
  didBackup: true,
  index: 0,
  isCold: false,
  canSendTransaction: true,
  nonce: 1
}
export default class WalletLTC extends Wallet {
  path = Keystore.CoinType.LTC.path
  type = 'litecoin'
  @observable isFetchingBalance = false
  @observable totalBalance = new BigNumber('0')
  @observable isHideValue = false
  @observable enableNotification = true
  @observable isRefresh = false

  constructor(obj, secureDS) {
    super(obj, secureDS)
    this.secureDS = secureDS
    const initObj = Object.assign({}, defaultObjWallet, obj) // copy
    this._validateData(initObj)

    Object.keys(initObj).forEach((k) => {
      if (k === 'balance') initObj[k] = new BigNumber(initObj.balance)
      if (k === 'totalBalance') initObj[k] = new BigNumber(initObj.totalBalance)
      if (k === 'address') initObj[k] = initObj.address

      this[k] = initObj[k]
    })
    this.tokens = [this.getTokenLTC()]
  }

  @action offLoading() {
    this.isFetchingBalance = false
    this.isRefresh = false
    this.loading = false
  }

  @action async fetchingBalance(isRefresh = false, isBackground = false) {
    if (this.loading) return

    this.loading = true
    this.isRefresh = isRefresh
    this.isFetchingBalance = !isRefresh && !isBackground
    try {
      const res = await api.fetchWalletLTCInfo(this.address)
      if (res.status !== 200) {
        this.offLoading()
        if (this.balance.toString(10) > 0) return
        this.balance = new BigNumber(`0`)
        this.totalBalance = this.balance
      } else if (res.data) {
        const { balance } = res.data.data
        this.balance = new BigNumber(balance).times(new BigNumber('1e+8'))
        this.totalBalance = new BigNumber(balance)
      } else {
        this.balance = new BigNumber(`0`)
        this.totalBalance = this.balance
      }

      this.tokens = [this.getTokenLTC()]
      this.tokens[0].transactions = res.data.data.txs.map(tx => new TransactionLTC(tx, 1))
      this.update()
      this.offLoading()
    } catch (e) {
      this.offLoading()
    }
  }

  @action async implementPrivateKey(secureDS, privateKey, coin = chainNames.LTC) {
    this.canSendTransaction = true
    this.importType = 'Private Key'
    const { address } = GetAddress(privateKey, coin)
    if (coin === chainNames.LTC && address !== this.address) {
      throw new Error('Invalid Private Key')
    }
    secureDS.savePrivateKey(this.address, privateKey)
  }

  @computed get totalBalanceDollar() {
    const rate = MainStore.appState.rateLTCDollar
    return this.totalBalanceETH.multipliedBy(rate)
  }

  getTokenLTC() {
    const tokenLTC = {
      tokenInfo: {
        address: this.address,
        name: 'Litecoin',
        symbol: 'LTC',
        decimals: 8,
        price: {
          rate: MainStore.appState.rateLTCDollar.toString(10)
        }
      },
      balance: this.balance.toString(10)
    }

    return new WalletTokenLTC(tokenLTC, this.address)
  }
}
