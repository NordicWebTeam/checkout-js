import {
    Cart,
    StoreConfig,
    CheckoutSelectors
} from '@bigcommerce/checkout-sdk';
import { noop } from 'lodash';
import React, { Component, ReactNode } from 'react';


const ingridApiUrl = process.env.API_URL;


export interface IngridProps {
    cart: Cart;
    config: StoreConfig;
    onReady?(): void;
    selectShippingOption (consignmentId: string, optionId?: string): void;
    selectDefaultShippingOptions: (state: CheckoutSelectors) => void;
    subscribeToConsignments(subscriber: (state: CheckoutSelectors) => void): () => void;
    consignments?: any;
}

interface ShippingState {
    isInitializing: boolean;
}

class IngridV1 extends Component<IngridProps , ShippingState> {
    constructor(props: IngridProps) {
        super(props);
        this.state = {
            isInitializing: true,
        };
    }

    getSiw(): void{
        let cart = this.props.cart;
        const  storeHash  = this.props.config.storeProfile.storeHash;
        const countryCode = this.props.consignments[0].address.countryCode;
        const postalCode = this.props.consignments[0].address.postalCode;
        
        fetch(`${ingridApiUrl}?store=${storeHash}&cart_id=${cart.id}&country_code=${countryCode}&postal_code=${postalCode}`, {cache: "no-store"})
        .then(response => response.text())
        .then(data => {
            const widgetDiv = document.getElementById('ingrid-widget');
            if (widgetDiv) {
                widgetDiv.innerHTML = data;
                this.replaceScriptNode(document.getElementById("shipwallet-container"));
                let self = this
                var checkExists = setInterval(() => {
                    if (!document.getElementById('ingrid-widget')){
                        clearInterval(checkExists);
                    }
                    let _Sw = (window as any)._sw;
                    if(_Sw) {
                        _Sw(function(api : any){
                            api.on('data_changed', function(m : any,b : any) {
                                if (!b.initial_load && b.shipping_method_changed || b.pickup_location_changed || b.delivery_address_changed || b.payment_method_changed || b.price_changed) {
                                    self.optionUpdated(m);
                                }
                            })
                            clearInterval(checkExists);
                        });
                    }
                }, 2000);
            }
        })
        .catch((err) => {
            console.error('error',err);
        });
    }

    optionUpdated(option?: unknown){
        const { subscribeToConsignments, consignments } = this.props;
        this.props.selectShippingOption(consignments[0].id);
        subscribeToConsignments(this.props.selectDefaultShippingOptions);
        if(option){
            //console.log('option',option);
        }
        
    }

    replaceScriptNode(node: any){
        if (!this.isExternalScript(node) && this.isScriptNode(node)) {
          node.parentNode.replaceChild(this.cloneScriptNode(node), node);
        } else {
          var i = 0,
            children = node.childNodes;
          while (i < children.length) {
            this.replaceScriptNode(children[i++]);
          }
        }
        return node;
      }
  
      isScriptNode(node: any)  {
        return node.nodeName === "SCRIPT";
      }
  
      isExternalScript(node: any) {
        return !!node.src && node.src !== "";
      }
  
      cloneScriptNode(node: any) {
        var script = document.createElement("script");
        script.text = node.innerHTML;
        for (var i = node.attributes.length - 1; i >= 0; i--) {
          script.setAttribute(node.attributes[i].name, node.attributes[i].value);
        }
        return script;
      }

    async componentDidMount(): Promise<void> {
        const {
            onReady = noop,
            //onUnhandledError = noop,
        } = this.props;

        try {
            onReady();
            this.getSiw();
        } catch (error) {
            //onUnhandledError(error);
        } finally {
            this.setState({ isInitializing: false });
        }
    }

    render(): ReactNode {
        return (
            <>
                <div id="ingrid-widget"></div>
                <style >{`
                    #checkout-shipping-options .shippingOptions-container {
                        display: none !important;
                    }
                `}</style>
            </>
        );
    }
}

export default IngridV1;